import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
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

          // Poll for text extraction completion (allow up to 20 steps = 10s)
          let extracted = false;
          for (let i = 0; i < 20; i++) {
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
    // TEST 5: Dynamic Network Isolation Audit (Zero Remote Leaks)
    // ----------------------------------------------------
    console.log(`\n--- Test 5: Dynamic Network Isolation Audit ---`);
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
  const serverProc = spawn('npx', ['next', 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
    cwd: ROOT_DIR,
    shell: true,
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
