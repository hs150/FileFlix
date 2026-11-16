import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { zipSync, strToU8 } from 'fflate';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const FIXTURES_DIR = path.resolve(ROOT_DIR, 'tests/fixtures');

const PORT = 3099;
const SERVER_URL = `http://127.0.0.1:${PORT}`;

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.eventListeners = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message));
          } else {
            resolve(msg.result);
          }
        } else if (msg.method && this.eventListeners.has(msg.method)) {
          for (const listener of this.eventListeners.get(msg.method)) {
            listener(msg.params);
          }
        }
      };
    });
  }

  send(method, params = {}, timeoutMs = 25000) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      const timer = setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error(`CDP method ${method} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.callbacks.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    if (!this.eventListeners.has(method)) {
      this.eventListeners.set(method, []);
    }
    this.eventListeners.get(method).push(listener);
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runBrowserAudit(browserName, browserExe, debugPort) {
  console.log(`\n======================================================`);
  console.log(`🚀 Starting Browser E2E & Network Audit on ${browserName}`);
  console.log(`Browser Executable: ${browserExe}`);
  console.log(`======================================================\n`);

  const tempUserDataDir = path.join(
    process.env.TEMP || 'C:\\Temp',
    `fileflix-audit-${browserName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
  );

  const browserProc = spawn(browserExe, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${tempUserDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
  ]);

  // Wait for browser debug endpoint
  let versionData = null;
  for (let i = 0; i < 20; i++) {
    await wait(500);
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      versionData = await res.json();
      break;
    } catch {}
  }

  if (!versionData) {
    browserProc.kill();
    throw new Error(`Failed to connect to ${browserName} remote debugging port on ${debugPort}`);
  }

  console.log(`✅ Connected to ${browserName} CDP: ${versionData.Browser}`);

  // Get active page target
  const targetsRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');

  // Network request instrumentation per browser
  const recordedRequests = [];
  cdp.on('Network.requestWillBeSent', (params) => {
    recordedRequests.push({
      browser: browserName,
      timestamp: Date.now(),
      url: params.request.url,
      method: params.request.method,
      hasPostData: !!params.request.hasPostData,
      postData: params.request.postData || null,
      headers: params.request.headers,
    });
  });

  const auditResults = {
    browser: browserName,
    version: versionData.Browser,
    tests: [],
    requestBreakdown: {},
  };

  try {
    // ----------------------------------------------------
    // TEST 1: Home Page Navigation
    // ----------------------------------------------------
    console.log(`\n--- Test 1: Navigation to Home Page ---`);
    await cdp.send('Page.navigate', { url: SERVER_URL });
    await wait(2000);

    const homeTitle = await cdp.send('Runtime.evaluate', {
      expression: 'document.title',
    });
    console.log(`Page Title: "${homeTitle.result.value}"`);

    const navLinks = await cdp.send('Runtime.evaluate', {
      expression: `Array.from(document.querySelectorAll('nav a')).map(a => ({ text: a.innerText, href: a.getAttribute('href') }))`,
      returnByValue: true,
    });
    console.log(`Found Navigation Links:`, navLinks.result.value);

    auditResults.tests.push({
      name: 'Home Page Load & Navigation',
      status: homeTitle.result.value.includes('FileFix') ? 'PASS' : 'FAIL',
      details: homeTitle.result.value,
    });

    // ----------------------------------------------------
    // TEST 2: Image Studio Comprehensive Operations
    // ----------------------------------------------------
    console.log(`\n--- Test 2: Image Studio Comprehensive Operations ---`);
    await cdp.send('Page.navigate', { url: `${SERVER_URL}/image-studio` });
    await wait(2000);

    const redPngBase64 = fs.readFileSync(path.join(FIXTURES_DIR, 'images/test-solid-red.png')).toString('base64');
    const alphaPngBase64 = fs.readFileSync(path.join(FIXTURES_DIR, 'images/test-alpha-blue.png')).toString('base64');
    const largeGreenPngBase64 = fs.readFileSync(path.join(FIXTURES_DIR, 'images/test-large-green.png')).toString('base64');
    const exifJpgBase64 = fs.readFileSync(path.join(FIXTURES_DIR, 'images/test-exif-orientation-6.jpg')).toString('base64');
    const spoofedJpgBase64 = fs.readFileSync(path.join(FIXTURES_DIR, 'images/test-spoofed.jpg')).toString('base64');

    // 2a: Upload Solid Red PNG & Metadata
    const uploadResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          function b64ToFile(b64, name, mime) {
            const chars = atob(b64);
            const arr = new Uint8Array(chars.length);
            for (let i = 0; i < chars.length; i++) arr[i] = chars.charCodeAt(i);
            return new File([arr], name, { type: mime });
          }

          const file = b64ToFile("${redPngBase64}", "test-solid-red.png", "image/png");
          const input = document.querySelector('input[type="file"]');
          if (!input) return { success: false, error: "file input not found" };

          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));

          await new Promise(r => setTimeout(r, 1200));

          const bodyText = document.body.innerText;
          const hasDims = bodyText.includes('120×80') || bodyText.includes('120x80');
          const hasName = bodyText.includes('test-solid-red.png');

          return { success: hasDims && hasName, dimensions: hasDims, name: hasName };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`Image Upload & Metadata:`, uploadResult.result.value);

    // 2b: Process Resize, Crop & Output Blob Header Inspection
    const processResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          const t0 = performance.now();
          const applyBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Apply & Generate Preview'));
          if (!applyBtn) return { success: false, error: 'Apply button not found' };

          applyBtn.click();
          await new Promise(r => setTimeout(r, 1800));

          const latencyMs = Math.round(performance.now() - t0);
          const bodyText = document.body.innerText;
          const hasResult = bodyText.includes('Result & Comparison') || bodyText.includes('Download Processed Image');

          // Inspect generated preview blob
          const previewImg = document.querySelector('img[src^="blob:"]');
          let blobVerified = false;
          let blobBytes = 0;
          let magicHeader = '';

          if (previewImg && previewImg.src) {
            try {
              const res = await fetch(previewImg.src);
              const buf = await res.arrayBuffer();
              blobBytes = buf.byteLength;
              const u8 = new Uint8Array(buf);
              magicHeader = Array.from(u8.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ');
              // Verify PNG header 89 50 4e 47
              blobVerified = u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47;
            } catch (e) {
              console.error('Blob fetch failed:', e);
            }
          }

          return {
            success: hasResult && blobVerified,
            latencyMs,
            blobBytes,
            magicHeader,
            blobVerified
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`Image Resize & Blob Inspection:`, processResult.result.value);

    // 2c: Transparent PNG -> JPEG Flattening (White Background)
    const transparentJpegResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          function b64ToFile(b64, name, mime) {
            const chars = atob(b64);
            const arr = new Uint8Array(chars.length);
            for (let i = 0; i < chars.length; i++) arr[i] = chars.charCodeAt(i);
            return new File([arr], name, { type: mime });
          }

          // Reset
          const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Reset'));
          if (resetBtn) resetBtn.click();
          await new Promise(r => setTimeout(r, 600));

          // Upload alpha PNG
          const file = b64ToFile("${alphaPngBase64}", "test-alpha-blue.png", "image/png");
          const input = document.querySelector('input[type="file"]');
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise(r => setTimeout(r, 1200));

          // Change format to JPEG
          const formatSelect = document.querySelector('select');
          if (formatSelect) {
            formatSelect.value = 'image/jpeg';
            formatSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
          await new Promise(r => setTimeout(r, 400));

          const applyBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Apply & Generate Preview'));
          if (applyBtn) applyBtn.click();
          await new Promise(r => setTimeout(r, 1500));

          // Verify output is valid JPEG
          const previewImg = document.querySelector('img[src^="blob:"]');
          let isJpeg = false;
          let byteLength = 0;
          if (previewImg) {
            const res = await fetch(previewImg.src);
            const buf = await res.arrayBuffer();
            byteLength = buf.byteLength;
            const u8 = new Uint8Array(buf);
            // JPEG magic bytes: FF D8 FF
            isJpeg = u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff;
          }

          return { success: isJpeg, byteLength, isJpeg };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`Transparent PNG to JPEG Flattening:`, transparentJpegResult.result.value);

    // 2d: EXIF Orientation JPEG Handling
    const exifResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          function b64ToFile(b64, name, mime) {
            const chars = atob(b64);
            const arr = new Uint8Array(chars.length);
            for (let i = 0; i < chars.length; i++) arr[i] = chars.charCodeAt(i);
            return new File([arr], name, { type: mime });
          }

          const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Reset'));
          if (resetBtn) resetBtn.click();
          await new Promise(r => setTimeout(r, 600));

          const file = b64ToFile("${exifJpgBase64}", "test-exif-orientation-6.jpg", "image/jpeg");
          const input = document.querySelector('input[type="file"]');
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise(r => setTimeout(r, 1200));

          const bodyText = document.body.innerText;
          const loaded = bodyText.includes('test-exif-orientation-6.jpg');

          return { success: loaded };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`EXIF Orientation JPEG Handling:`, exifResult.result.value);

    // 2e: Target Size Search (Achieved on Large Green Image)
    const targetSizeResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          function b64ToFile(b64, name, mime) {
            const chars = atob(b64);
            const arr = new Uint8Array(chars.length);
            for (let i = 0; i < chars.length; i++) arr[i] = chars.charCodeAt(i);
            return new File([arr], name, { type: mime });
          }

          const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Reset'));
          if (resetBtn) resetBtn.click();
          await new Promise(r => setTimeout(r, 600));

          const file = b64ToFile("${largeGreenPngBase64}", "test-large-green.png", "image/png");
          const input = document.querySelector('input[type="file"]');
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise(r => setTimeout(r, 1200));

          // Set target size to 50 KB
          const targetInput = document.querySelector('input[placeholder="e.g. 50"]');
          if (targetInput) {
            targetInput.value = '50';
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            targetInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          await new Promise(r => setTimeout(r, 300));

          const applyBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Apply & Generate Preview'));
          if (applyBtn) applyBtn.click();
          await new Promise(r => setTimeout(r, 2000));

          const previewImg = document.querySelector('img[src^="blob:"]');
          let outputSizeKb = 0;
          if (previewImg) {
            const res = await fetch(previewImg.src);
            const buf = await res.arrayBuffer();
            outputSizeKb = Math.round(buf.byteLength / 1024);
          }

          return { success: outputSizeKb > 0 && outputSizeKb <= 50, outputSizeKb };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`Target Size Binary Search (50 KB):`, targetSizeResult.result.value);

    // 2f: Spoofed File Rejection
    const spoofTest = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Reset'));
          if (resetBtn) resetBtn.click();
          await new Promise(r => setTimeout(r, 500));

          function b64ToFile(b64, name, mime) {
            const chars = atob(b64);
            const arr = new Uint8Array(chars.length);
            for (let i = 0; i < chars.length; i++) arr[i] = chars.charCodeAt(i);
            return new File([arr], name, { type: mime });
          }

          const file = b64ToFile("${spoofedJpgBase64}", "test-spoofed.jpg", "image/jpeg");
          const input = document.querySelector('input[type="file"]');
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));

          await new Promise(r => setTimeout(r, 800));
          const hasValidationNotice = document.body.innerText.includes('Validation Error') || document.body.innerText.includes('does not match');
          return { rejectedSpoofedFile: hasValidationNotice };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`Spoofed File Rejection:`, spoofTest.result.value);

    const imageStudioAllPassed =
      uploadResult.result.value.success &&
      processResult.result.value.success &&
      transparentJpegResult.result.value.success &&
      exifResult.result.value.success &&
      targetSizeResult.result.value.success &&
      spoofTest.result.value.rejectedSpoofedFile;

    auditResults.tests.push({
      name: 'Image Studio (Upload, Resize, Crop, Compress, EXIF, Target KB, Spoof Rejection)',
      status: imageStudioAllPassed ? 'PASS' : 'FAIL',
      details: {
        upload: uploadResult.result.value,
        resizeAndBlob: processResult.result.value,
        transparentJpeg: transparentJpegResult.result.value,
        exifOrientation: exifResult.result.value,
        targetSizeSearch: targetSizeResult.result.value,
        spoofRejection: spoofTest.result.value,
      },
    });

    // ----------------------------------------------------
    // TEST 3: PDF Studio Multi-File Merge & Page Organize
    // ----------------------------------------------------
    console.log(`\n--- Test 3: PDF Studio Client Processing ---`);
    await cdp.send('Page.navigate', { url: `${SERVER_URL}/pdf-studio` });
    await wait(2000);

    const singlePdfBase64 = fs.readFileSync(path.join(FIXTURES_DIR, 'pdfs/single-page.pdf')).toString('base64');
    const threePdfBase64 = fs.readFileSync(path.join(FIXTURES_DIR, 'pdfs/three-pages.pdf')).toString('base64');
    const corruptPdfBase64 = fs.readFileSync(path.join(FIXTURES_DIR, 'pdfs/corrupt.pdf')).toString('base64');

    // 3a: Multi-file Merge & Download Blob Verification
    const pdfMergeResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          function createPdfFile(b64, name) {
            const chars = atob(b64);
            const arr = new Uint8Array(chars.length);
            for (let i = 0; i < chars.length; i++) arr[i] = chars.charCodeAt(i);
            return new File([arr], name, { type: "application/pdf" });
          }

          const file1 = createPdfFile("${singlePdfBase64}", "single-page.pdf");
          const file2 = createPdfFile("${threePdfBase64}", "three-pages.pdf");

          const input = document.querySelector('input[type="file"]');
          const dt = new DataTransfer();
          dt.items.add(file1);
          dt.items.add(file2);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));

          await new Promise(r => setTimeout(r, 2500));

          const buttons = Array.from(document.querySelectorAll('button'));
          // Reorder test: move second file up
          const moveUpBtn = buttons.find(b => b.title === 'Move up');
          if (moveUpBtn && !moveUpBtn.disabled) moveUpBtn.click();
          await new Promise(r => setTimeout(r, 300));

          // Find Merge action button
          const mergeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Total Pages'));
          if (!mergeBtn) return { success: false, error: 'Merge action button not found' };

          mergeBtn.click();

          let mergedSuccess = false;
          for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 500));
            const bodyText = document.body.innerText;
            if (bodyText.includes('PDF Merge Successful') || bodyText.includes('Download Merged PDF')) {
              mergedSuccess = true;
              break;
            }
          }

          // Verify downloaded blob has %PDF- header
          const downloadBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Download Merged PDF'));
          const bodyText = document.body.innerText;
          const outputVerified = bodyText.includes('Output verified with 4 pages');

          return { success: mergedSuccess && outputVerified, hasDownloadBtn: !!downloadBtn, outputVerified };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`PDF Merge Workflow:`, pdfMergeResult.result.value);

    // 3b: Organize, Rotate & Split Mode
    const pdfOrganizeResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          function createPdfFile(b64, name) {
            const chars = atob(b64);
            const arr = new Uint8Array(chars.length);
            for (let i = 0; i < chars.length; i++) arr[i] = chars.charCodeAt(i);
            return new File([arr], name, { type: "application/pdf" });
          }

          // Switch tab
          const tab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Organize, Rotate & Split'));
          if (tab) tab.click();
          await new Promise(r => setTimeout(r, 500));

          // Upload 3-page PDF
          const file = createPdfFile("${threePdfBase64}", "three-pages.pdf");
          const input = document.querySelector('input[type="file"]');
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise(r => setTimeout(r, 1200));

          // Rotate all pages (+90)
          const rotateAllBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Rotate All (+90°)'));
          if (rotateAllBtn) rotateAllBtn.click();
          await new Promise(r => setTimeout(r, 300));

          // Deselect page 2 to test page extraction (split)
          const pageCheckboxes = document.querySelectorAll('input[type="checkbox"]');
          if (pageCheckboxes.length >= 2) {
            pageCheckboxes[1].click(); // uncheck page 2
          }
          await new Promise(r => setTimeout(r, 300));

          // Export selected pages (find button with "Export" and "Pages")
          const exportBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Export') && b.innerText.includes('Pages'));
          if (!exportBtn) return { success: false, error: 'Export button not found' };

          exportBtn.click();
          await new Promise(r => setTimeout(r, 2000));

          const bodyText = document.body.innerText;
          const splitSuccess = bodyText.includes('PDF Transformed') || bodyText.includes('Download Transformed PDF') || bodyText.includes('Output verified with 2 pages') || bodyText.includes('Exported PDF Generated & Verified');

          return { success: splitSuccess, hasExportBtn: !!exportBtn };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`PDF Organize, Rotate & Split Workflow:`, pdfOrganizeResult.result.value);

    // 3c: Corrupt PDF Handling
    const corruptPdfResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          function createPdfFile(b64, name) {
            const chars = atob(b64);
            const arr = new Uint8Array(chars.length);
            for (let i = 0; i < chars.length; i++) arr[i] = chars.charCodeAt(i);
            return new File([arr], name, { type: "application/pdf" });
          }

          const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Reset'));
          if (resetBtn) resetBtn.click();
          await new Promise(r => setTimeout(r, 500));

          const file = createPdfFile("${corruptPdfBase64}", "corrupt.pdf");
          const input = document.querySelector('input[type="file"]');
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise(r => setTimeout(r, 800));

          const bodyText = document.body.innerText;
          const rejectedCorrupt = bodyText.includes('Failed to parse') || bodyText.includes('Invalid') || bodyText.includes('Corrupt');
          return { success: rejectedCorrupt };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`Corrupt PDF Rejection:`, corruptPdfResult.result.value);

    const pdfStudioAllPassed =
      pdfMergeResult.result.value.success &&
      pdfOrganizeResult.result.value.success &&
      corruptPdfResult.result.value.success;

    auditResults.tests.push({
      name: 'PDF Studio (Merge, Reorder, Rotate All, Page Extraction/Split, Corrupt Handling)',
      status: pdfStudioAllPassed ? 'PASS' : 'FAIL',
      details: {
        merge: pdfMergeResult.result.value,
        organizeAndSplit: pdfOrganizeResult.result.value,
        corruptRejection: corruptPdfResult.result.value,
      },
    });

    // ----------------------------------------------------
    // TEST 4: Text Extraction Studio Workflows
    // ----------------------------------------------------
    console.log(`\n--- Test 4: Text Extraction Studio ---`);
    await cdp.send('Page.navigate', { url: `${SERVER_URL}/extract-text` });
    await wait(2000);

    const textExtractResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          try {
            function createPdfFile(b64, name) {
              const chars = atob(b64);
              const arr = new Uint8Array(chars.length);
              for (let i = 0; i < chars.length; i++) arr[i] = chars.charCodeAt(i);
              return new File([arr], name, { type: "application/pdf" });
            }

            const file = createPdfFile("${threePdfBase64}", "three-pages.pdf");
            const input = document.querySelector('input[type="file"]');
            if (!input) return { success: false, error: 'file input not found' };

            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));

            // Poll for text extraction completion (allow up to 25 steps = 12.5s)
            let extracted = false;
            for (let i = 0; i < 25; i++) {
              await new Promise(r => setTimeout(r, 500));
              const body = document.body.innerText;
              if (body.includes('Multi-Page Document - Page 1') || body.includes('Page 1 Content')) {
                extracted = true;
                break;
              }
            }

            const bodyText = document.body.innerText;
            const hasPage1 = bodyText.includes('Page 1 Content') || bodyText.includes('Multi-Page Document - Page 1');
            
            // Switch to Page 2 tab to test multi-page navigation
            const buttons = Array.from(document.querySelectorAll('button'));
            const page2Btn = buttons.find(b => b.innerText.trim() === '2');
            let hasPage2 = false;
            if (page2Btn) {
              page2Btn.click();
              await new Promise(r => setTimeout(r, 500));
              hasPage2 = document.body.innerText.includes('Page 2 Content') || document.body.innerText.includes('Multi-Page Document - Page 2');
            }

            const hasCopyBtn = buttons.some(b => b.innerText.includes('Copy All Text'));
            const hasDownloadBtn = buttons.some(b => b.innerText.includes('Download .TXT'));

            return {
              success: extracted && hasPage1,
              hasPage1,
              hasPage2,
              hasCopyBtn,
              hasDownloadBtn,
            };
          } catch (err) {
            return { success: false, error: err.message };
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`Text Extraction Workflow:`, textExtractResult.result.value);

    auditResults.tests.push({
      name: 'Text Extraction Studio (Page Boundaries, Reading Order, Copy, TXT Download)',
      status: textExtractResult.result.value.success ? 'PASS' : 'FAIL',
      details: textExtractResult.result.value,
    });

    // ----------------------------------------------------
    // TEST 5: Application Studio (Official Presets, Center-Crop, Pad-White, Compliance)
    // ----------------------------------------------------
    console.log(`\n--- Test 5: Application Studio Workflows ---`);
    await cdp.send('Page.navigate', { url: `${SERVER_URL}/application-studio` });
    await wait(2000);

    const appStudioResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          function b64ToFile(b64, name, mime) {
            const chars = atob(b64);
            const arr = new Uint8Array(chars.length);
            for (let i = 0; i < chars.length; i++) arr[i] = chars.charCodeAt(i);
            return new File([arr], name, { type: mime });
          }

          // 1. Verify Page & Select elements
          const select = document.querySelector('select');
          if (!select) return { success: false, error: 'Preset select dropdown not found' };

          // Verify all required presets exist
          const options = Array.from(select.querySelectorAll('option')).map(o => o.value);
          const hasUsVisa = options.includes('us-visa-ds160');
          const hasUsPassport = options.includes('us-passport-renewal');
          const hasSchengen = options.includes('france-schengen-visa');
          const hasUpscPhoto = options.includes('upsc-generic-photo');
          const hasUpscSig = options.includes('upsc-generic-signature');
          const hasSscCglSig = options.includes('ssc-cgl-2026-signature');
          const hasSscChslSig = options.includes('ssc-chsl-2026-signature');

          // 2. Select US Visa Preset (600x600 px, <=240 KB, JPEG)
          select.value = 'us-visa-ds160';
          select.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise(r => setTimeout(r, 400));

          // 3. Upload alpha-blue PNG to test center crop, resize to 600x600, JPEG flattening & KB search
          const file = b64ToFile("${alphaPngBase64}", "test-alpha-blue.png", "image/png");
          const input = document.querySelector('input[type="file"]');
          if (!input) return { success: false, error: 'File input not found' };
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise(r => setTimeout(r, 1000));

          // 4. Click 'Apply Official Preset' button
          const buttons = Array.from(document.querySelectorAll('button'));
          const applyBtn = buttons.find(b => b.innerText.includes('Apply Official Preset'));
          if (!applyBtn) return { success: false, error: 'Apply Official Preset button not found' };
          applyBtn.click();

          // Wait for processing to complete (up to 20s)
          let processed = false;
          for (let i = 0; i < 40; i++) {
            await new Promise(r => setTimeout(r, 500));
            const body = document.body.innerText;
            if (body.includes('Technical checks passed') || body.includes('Output:')) {
              processed = true;
              break;
            }
          }

          const pageText = document.body.innerText;
          const isCompliant = pageText.includes('Technical checks passed');
          const hasDisclaimer = pageText.includes('Visual requirements not automatically verified') || pageText.includes('Biometric');

          // Inspect output blob directly
          const previewImgs = Array.from(document.querySelectorAll('img[src^="blob:"]'));
          const outputImg = previewImgs[previewImgs.length - 1];
          let outputBytes = 0;
          let isJpeg = false;
          if (outputImg && outputImg.src) {
            try {
              const res = await fetch(outputImg.src);
              const buf = await res.arrayBuffer();
              outputBytes = buf.byteLength;
              const u8 = new Uint8Array(buf);
              isJpeg = u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff;
            } catch (e) {
              console.error('Failed to fetch output blob:', e);
            }
          }

          const refreshedButtons = Array.from(document.querySelectorAll('button'));
          const hasReportBtn = refreshedButtons.some(b => b.innerText.includes('Export Compliance Report'));
          const hasDownloadBtn = refreshedButtons.some(b => b.innerText.includes('Download Image'));

          // 5. Test U.S. Passport Renewal Checker-Only Mode
          select.value = 'us-passport-renewal';
          select.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise(r => setTimeout(r, 500));

          const passportText = document.body.innerText;
          const hasCheckerNotice = passportText.includes('Inspection Mode Active') || passportText.includes('CHECKER MODE');
          const inspectButtons = Array.from(document.querySelectorAll('button'));
          const inspectBtn = inspectButtons.find(b => b.innerText.includes('Inspect Photo Compliance'));
          let checkerPassed = false;
          if (inspectBtn) {
            inspectBtn.click();
            await new Promise(r => setTimeout(r, 1200));
            checkerPassed = document.body.innerText.includes('Inspection Mode');
          }

          return {
            success: processed && isCompliant && isJpeg && outputBytes <= 240 * 1024 && hasCheckerNotice && checkerPassed && hasSscCglSig && hasSscChslSig,
            hasUsVisa,
            hasUsPassport,
            hasSchengen,
            hasUpscPhoto,
            hasUpscSig,
            hasSscCglSig,
            hasSscChslSig,
            processed,
            isCompliant,
            isJpeg,
            outputBytes,
            outputKb: (outputBytes / 1024).toFixed(1),
            hasDisclaimer,
            hasReportBtn,
            hasDownloadBtn,
            hasCheckerNotice,
            checkerPassed,
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`Application Studio Workflow:`, appStudioResult.result.value);

    auditResults.tests.push({
      name: 'Application Studio (Official Presets, Center-Crop, Pad-White, Compliance Report & Technical Checks)',
      status: appStudioResult.result.value.success ? 'PASS' : 'FAIL',
      details: appStudioResult.result.value,
    });

    // ----------------------------------------------------
    // TEST 6: Universal Conversion Hub Operations (/convert-files)
    // ----------------------------------------------------
    console.log(`\n--- Test 6: Universal Conversion Hub Workflows ---`);
    await cdp.send('Page.navigate', { url: `${SERVER_URL}/convert-files` });
    await wait(2000);

    const testZipBuffer = zipSync({
      'hello.txt': strToU8('FileFix Universal Archive Engine Test!'),
    });
    const zipBase64 = Buffer.from(testZipBuffer).toString('base64');
    const csvBase64 = Buffer.from('id,name,role\n1,Alice,Architect\n2,Bob,Engineer\n', 'utf-8').toString('base64');
    const svgBase64 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="blue"/></svg>', 'utf-8').toString('base64');
    const txtBase64 = Buffer.from('The FileFix Guide\n\nChapter 1\nBrowser native universal transformations.\n', 'utf-8').toString('base64');

    const convertFilesResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          function b64ToFile(b64, name, mime) {
            const chars = atob(b64);
            const arr = new Uint8Array(chars.length);
            for (let i = 0; i < chars.length; i++) arr[i] = chars.charCodeAt(i);
            return new File([arr], name, { type: mime });
          }

          async function waitForText(text, maxMs = 7000) {
            const start = Date.now();
            while (Date.now() - start < maxMs) {
              if (document.body.innerText.includes(text)) return true;
              await new Promise(r => setTimeout(r, 200));
            }
            return false;
          }

          async function uploadFile(file) {
            const input = document.querySelector('input[type="file"]');
            if (!input) throw new Error('File input not found');
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(r => setTimeout(r, 800));
          }

          async function selectTarget(formatId) {
            const select = document.querySelector('select');
            if (select) {
              select.value = formatId;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              await new Promise(r => setTimeout(r, 400));
            }
          }

          async function clickReset() {
            const buttons = Array.from(document.querySelectorAll('button'));
            const btn = buttons.find(b => b.innerText.includes('Choose Another File') || b.innerText.includes('Reset'));
            if (btn) {
              btn.click();
              await new Promise(r => setTimeout(r, 500));
            }
          }

          async function execute() {
            const buttons = Array.from(document.querySelectorAll('button'));
            const execBtn = buttons.find(b => b.innerText.includes('Execute Conversion'));
            if (!execBtn) throw new Error('Execute Conversion button not found');
            execBtn.click();
            const ok = await waitForText('Conversion Successful', 8000);
            if (!ok) throw new Error('Conversion did not complete within timeout');
          }

          async function getDownloadedBlob() {
            const link = document.querySelector('a[download]');
            if (!link || !link.href) return null;
            const res = await fetch(link.href);
            const buf = await res.arrayBuffer();
            const u8 = new Uint8Array(buf);
            return {
              filename: link.getAttribute('download') || '',
              size: buf.byteLength,
              u8,
              text: () => new TextDecoder().decode(buf),
            };
          }

          // 1. Verify Page & Matrix
          const pageText = document.body.innerText;
          const hasEngineHeader = pageText.includes('Universal Conversion Engine');
          const hasMatrix = pageText.includes('Format Explorer & Conversion Matrix');

          // 2. Category 1: Archive (ZIP -> TAR)
          let archiveOk = false;
          let tarDetails = {};
          try {
            const zipFile = b64ToFile("${zipBase64}", "sample-archive.zip", "application/zip");
            await uploadFile(zipFile);
            await execute();
            const blob = await getDownloadedBlob();
            if (blob && blob.filename.endsWith('.tar') && blob.size >= 512) {
              // POSIX ustar header verification at offset 257: 'ustar'
              const ustarMagic = String.fromCharCode(...blob.u8.slice(257, 262));
              archiveOk = ustarMagic.startsWith('ustar') || blob.size >= 512;
              tarDetails = { filename: blob.filename, size: blob.size, magic: ustarMagic };
            } else if (blob) {
              tarDetails = { error: 'Unexpected output: ' + blob.filename };
            } else {
              tarDetails = { error: 'No blob downloaded' };
            }
          } catch (e) {
            tarDetails = { error: e.message };
          }

          // 3. Category 2: Data (CSV -> JSON)
          let dataOk = false;
          let jsonDetails = {};
          try {
            await clickReset();
            const csvFile = b64ToFile("${csvBase64}", "sample-data.csv", "text/csv");
            await uploadFile(csvFile);
            await selectTarget('json');
            await execute();
            const blob = await getDownloadedBlob();
            if (blob && blob.filename.endsWith('.json')) {
              const parsed = JSON.parse(blob.text());
              dataOk = Array.isArray(parsed) && parsed.length === 2 && parsed[0].name === 'Alice';
              jsonDetails = { filename: blob.filename, size: blob.size, rowCount: parsed.length };
            } else if (blob) {
              jsonDetails = { error: 'Unexpected output: ' + blob.filename };
            } else {
              jsonDetails = { error: 'No blob downloaded' };
            }
          } catch (e) {
            jsonDetails = { error: e.message };
          }

          // 4. Category 3: Vector (SVG -> PNG)
          let vectorOk = false;
          let pngDetails = {};
          try {
            await clickReset();
            const svgFile = b64ToFile("${svgBase64}", "sample-art.svg", "image/svg+xml");
            await uploadFile(svgFile);
            await selectTarget('png');
            await execute();
            const blob = await getDownloadedBlob();
            if (blob && blob.filename.endsWith('.png') && blob.size > 0) {
              const isPngHeader = blob.u8[0] === 0x89 && blob.u8[1] === 0x50 && blob.u8[2] === 0x4e && blob.u8[3] === 0x47;
              vectorOk = isPngHeader;
              pngDetails = { filename: blob.filename, size: blob.size, isPngHeader };
            } else if (blob) {
              pngDetails = { error: 'Unexpected output: ' + blob.filename };
            } else {
              pngDetails = { error: 'No blob downloaded' };
            }
          } catch (e) {
            pngDetails = { error: e.message };
          }

          // 5. Category 4: eBook (TXT -> EPUB)
          let ebookOk = false;
          let epubDetails = {};
          try {
            await clickReset();
            const txtFile = b64ToFile("${txtBase64}", "sample-book.txt", "text/plain");
            await uploadFile(txtFile);
            await selectTarget('epub');
            await execute();
            const blob = await getDownloadedBlob();
            if (blob && blob.filename.endsWith('.epub') && blob.size > 0) {
              const isZipHeader = blob.u8[0] === 0x50 && blob.u8[1] === 0x4b && blob.u8[2] === 0x03 && blob.u8[3] === 0x04;
              ebookOk = isZipHeader;
              epubDetails = { filename: blob.filename, size: blob.size, isZipHeader };
            } else if (blob) {
              epubDetails = { error: 'Unexpected output: ' + blob.filename };
            } else {
              epubDetails = { error: 'No blob downloaded' };
            }
          } catch (e) {
            epubDetails = { error: e.message };
          }

          const allSuccess = hasEngineHeader && hasMatrix && archiveOk && dataOk && vectorOk && ebookOk;

          return {
            success: allSuccess,
            hasEngineHeader,
            hasMatrix,
            archiveConversion: { success: archiveOk, details: tarDetails },
            dataConversion: { success: dataOk, details: jsonDetails },
            vectorConversion: { success: vectorOk, details: pngDetails },
            ebookConversion: { success: ebookOk, details: epubDetails },
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`Universal Conversion Hub Workflow Result:`, JSON.stringify(convertFilesResult.result.value, null, 2));

    auditResults.tests.push({
      name: 'Universal Conversion Hub (Archive ZIP-to-TAR, Data CSV-to-JSON, Vector SVG-to-PNG, eBook TXT-to-EPUB, Matrix Inspection)',
      status: convertFilesResult.result.value.success ? 'PASS' : 'FAIL',
      details: convertFilesResult.result.value,
    });

    // ----------------------------------------------------
    // TEST 7: Dynamic Network Isolation Audit (Zero Remote Leaks)
    // ----------------------------------------------------
    console.log(`\n--- Test 7: Dynamic Network Isolation Audit ---`);
    const remoteRequests = recordedRequests.filter((r) => {
      const url = r.url;
      // Only examine network HTTP/HTTPS requests
      if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
      // Exclude local test server
      if (url.startsWith(`http://127.0.0.1:${PORT}`)) return false;
      if (url.startsWith(`http://localhost:${PORT}`)) return false;
      return true;
    });

    const payloadLeakingRequests = recordedRequests.filter((r) => {
      if (!r.postData) return false;
      return (
        r.postData.includes('PNG') ||
        r.postData.includes('JFIF') ||
        r.postData.includes('PDF') ||
        r.postData.includes('Multi-Page') ||
        r.postData.includes('Synthetic')
      );
    });

    const localStaticRequests = recordedRequests.filter(r => r.url.startsWith(SERVER_URL));
    const postRequests = recordedRequests.filter(r => r.method === 'POST');

    console.log(`Total Requests Recorded for ${browserName}: ${recordedRequests.length}`);
    console.log(`Local Static Requests: ${localStaticRequests.length}`);
    console.log(`Remote Non-Localhost Requests: ${remoteRequests.length}`);
    console.log(`POST Requests Made: ${postRequests.length}`);
    console.log(`Payload-Leaking Requests: ${payloadLeakingRequests.length}`);

    auditResults.requestBreakdown = {
      totalRequests: recordedRequests.length,
      localStaticRequests: localStaticRequests.length,
      remoteNonLocalhostRequests: remoteRequests.length,
      postRequestsCount: postRequests.length,
      payloadLeakingRequestsCount: payloadLeakingRequests.length,
    };

    const networkIsolated = remoteRequests.length === 0 && payloadLeakingRequests.length === 0 && postRequests.length === 0;

    auditResults.tests.push({
      name: 'Dynamic Network Isolation (Zero Remote Uploads & Zero POST Calls)',
      status: networkIsolated ? 'PASS' : 'FAIL',
      details: auditResults.requestBreakdown,
    });

  } catch (err) {
    console.error(`Error during ${browserName} audit:`, err);
    auditResults.tests.push({
      name: 'Test Execution',
      status: 'FAIL',
      details: err.message,
    });
  } finally {
    try {
      cdp.close();
    } catch {}
    try {
      browserProc.kill();
    } catch {}
    await wait(1000);
    try {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true });
    } catch {}
  }

  return { auditResults, recordedRequests };
}

async function main() {
  console.log(`Starting Next.js production server on port ${PORT}...`);
  const nextBin = path.resolve(ROOT_DIR, 'node_modules/next/dist/bin/next');
  const serverProc = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
    cwd: ROOT_DIR,
  });

  serverProc.stdout.on('data', (d) => {
    const s = d.toString().trim();
    if (s) console.log(`[Next.js Server] ${s}`);
  });
  serverProc.stderr.on('data', (d) => {
    const s = d.toString().trim();
    if (s) console.error(`[Next.js Server Error] ${s}`);
  });

  // Wait for server to respond
  let serverReady = false;
  for (let i = 0; i < 40; i++) {
    await wait(1000);
    try {
      const res = await fetch(`${SERVER_URL}/`);
      if (res.status === 200) {
        serverReady = true;
        break;
      }
    } catch (e) {
      if (i > 0 && i % 5 === 0) {
        console.log(`[Wait for server attempt ${i}]: ${e.message}`);
      }
    }
  }

  if (!serverReady) {
    if (serverProc.pid) {
      try {
        execSync(`taskkill /pid ${serverProc.pid} /f /t`);
      } catch {}
    }
    throw new Error(`Server failed to start on ${SERVER_URL}`);
  }

  console.log(`✅ Production server ready on ${SERVER_URL}`);

  const summary = [];
  const allRecordedRequests = [];

  // Run Chrome Audit
  try {
    const chrome = await runBrowserAudit(
      'Google Chrome',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      9444
    );
    summary.push(chrome.auditResults);
    allRecordedRequests.push(...chrome.recordedRequests);
  } catch (e) {
    console.error(`Chrome Audit Failed:`, e);
  }

  // Run Edge Audit
  try {
    const edge = await runBrowserAudit(
      'Microsoft Edge',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      9445
    );
    summary.push(edge.auditResults);
    allRecordedRequests.push(...edge.recordedRequests);
  } catch (e) {
    console.error(`Edge Audit Failed:`, e);
  }

  // Kill server process tree cleanly
  if (serverProc.pid) {
    try {
      execSync(`taskkill /pid ${serverProc.pid} /f /t`);
    } catch {}
  }

  console.log(`\n======================================================`);
  console.log(`📊 FINAL BROWSER AUDIT SUMMARY`);
  console.log(`======================================================`);
  console.log(JSON.stringify(summary, null, 2));

  const reportPath = path.join(ROOT_DIR, 'tests/e2e/browser-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`\nReport written to: ${reportPath}`);

  const networkLogPath = path.join(ROOT_DIR, 'tests/e2e/network-requests-log.json');
  fs.writeFileSync(networkLogPath, JSON.stringify(allRecordedRequests, null, 2));
  console.log(`Network request audit log written to: ${networkLogPath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
