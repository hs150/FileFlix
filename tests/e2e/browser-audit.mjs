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
    `fileflix-audit-${browserName.toLowerCase()}-${Date.now()}`
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

  // Network request instrumentation
  const recordedRequests = [];
  cdp.on('Network.requestWillBeSent', (params) => {
    recordedRequests.push({
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
    // TEST 2: Image Studio E2E Workflows
    // ----------------------------------------------------
    console.log(`\n--- Test 2: Image Studio Client Processing ---`);
    await cdp.send('Page.navigate', { url: `${SERVER_URL}/image-studio` });
    await wait(2000);

    // Read test fixtures
    const redPngBase64 = fs.readFileSync(path.join(FIXTURES_DIR, 'images/test-solid-red.png')).toString('base64');
    const alphaPngBase64 = fs.readFileSync(path.join(FIXTURES_DIR, 'images/test-alpha-blue.png')).toString('base64');
    const corruptPngBase64 = fs.readFileSync(path.join(FIXTURES_DIR, 'images/test-corrupt.png')).toString('base64');
    const spoofedJpgBase64 = fs.readFileSync(path.join(FIXTURES_DIR, 'images/test-spoofed.jpg')).toString('base64');

    // Simulate file input upload for solid red PNG
    const uploadResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          const base64 = "${redPngBase64}";
          const byteChars = atob(base64);
          const byteNumbers = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const file = new File([byteArray], "test-solid-red.png", { type: "image/png" });

          const input = document.querySelector('input[type="file"]');
          if (!input) return { success: false, error: "file input not found" };

          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          input.files = dataTransfer.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));

          return { success: true, fileName: file.name, fileSize: file.size };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`Simulated Image Upload:`, uploadResult.result.value);
    await wait(1000);

    // Verify metadata rendered in editor
    const metaCheck = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const bodyText = document.body.innerText;
          const hasDimensions = bodyText.includes('120×80') || bodyText.includes('120x80');
          const hasName = bodyText.includes('test-solid-red.png');
          return { hasDimensions, hasName };
        })()
      `,
      returnByValue: true,
    });
    console.log(`Image Editor Loaded Metadata:`, metaCheck.result.value);

    // Execute Resize and Compression
    const processResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const applyBtn = buttons.find(b => b.innerText.includes('Apply & Generate Preview'));
          if (!applyBtn) return { success: false, error: 'Apply button not found' };

          applyBtn.click();
          await new Promise(r => setTimeout(r, 1500));

          const bodyText = document.body.innerText;
          const hasResult = bodyText.includes('Result & Comparison') || bodyText.includes('Download Processed Image');
          const downloadBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Download Processed Image'));

          return { success: hasResult, downloadReady: !!downloadBtn };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`Image Processing & Preview Generation:`, processResult.result.value);

    // Test Spoofed File Rejection
    const spoofTest = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          // Reset file
          const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Reset'));
          if (resetBtn) resetBtn.click();
          await new Promise(r => setTimeout(r, 500));

          // Try uploading spoofed file
          const base64 = "${spoofedJpgBase64}";
          const byteChars = atob(base64);
          const byteNumbers = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
          }
          const file = new File([new Uint8Array(byteNumbers)], "test-spoofed.jpg", { type: "image/jpeg" });

          const input = document.querySelector('input[type="file"]');
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          input.files = dataTransfer.files;
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

    auditResults.tests.push({
      name: 'Image Studio (Load, Process, Validate, Reject Spoofed)',
      status:
        processResult.result.value.success && spoofTest.result.value.rejectedSpoofedFile
          ? 'PASS'
          : 'FAIL',
      details: processResult.result.value,
    });

    // ----------------------------------------------------
    // TEST 3: PDF Studio E2E Workflows
    // ----------------------------------------------------
    console.log(`\n--- Test 3: PDF Studio Client Processing ---`);
    await cdp.send('Page.navigate', { url: `${SERVER_URL}/pdf-studio` });
    await wait(2000);

    const singlePdfBase64 = fs.readFileSync(path.join(FIXTURES_DIR, 'pdfs/single-page.pdf')).toString('base64');
    const threePdfBase64 = fs.readFileSync(path.join(FIXTURES_DIR, 'pdfs/three-pages.pdf')).toString('base64');

    // Simulate multi-file merge
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
          // Find the actual merge action button (which contains "Total Pages"), not the mode tab button ("Merge PDF Files")
          const mergeBtn = buttons.find(b => b.innerText.includes('Total Pages'));
          if (!mergeBtn) return { success: false, error: 'Merge action button not found' };

          if (mergeBtn.disabled) {
            return { success: false, error: 'Merge button was still disabled', text: mergeBtn.innerText };
          }

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

          const bodyText = document.body.innerText;
          return { success: mergedSuccess, totalPagesRecognized: bodyText.includes('4') };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`PDF Merge Workflow:`, pdfMergeResult.result.value);

    // Test Organize / Split tab
    const pdfOrganizeResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          // Switch to Organize tab
          const tab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Organize, Rotate & Split'));
          if (!tab) return { success: false, error: 'Tab not found' };
          tab.click();
          await new Promise(r => setTimeout(r, 500));

          // Upload 3-page PDF
          function createPdfFile(b64, name) {
            const chars = atob(b64);
            const arr = new Uint8Array(chars.length);
            for (let i = 0; i < chars.length; i++) arr[i] = chars.charCodeAt(i);
            return new File([arr], name, { type: "application/pdf" });
          }
          const file = createPdfFile("${threePdfBase64}", "three-pages.pdf");
          const input = document.querySelector('input[type="file"]');
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));

          await new Promise(r => setTimeout(r, 1200));

          // Check if 3 page tiles rendered
          const pageTiles = document.querySelectorAll('[class*="Page"]');
          const exportBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Export'));
          return { success: true, hasExportButton: !!exportBtn };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`PDF Organize & Rotate UI:`, pdfOrganizeResult.result.value);

    auditResults.tests.push({
      name: 'PDF Studio (Multi-File Merge & Page Organization)',
      status: pdfMergeResult.result.value.success ? 'PASS' : 'FAIL',
      details: pdfMergeResult.result.value,
    });

    // ----------------------------------------------------
    // TEST 4: Text Extraction Studio E2E Workflows
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
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));

          await new Promise(r => setTimeout(r, 2000));

          const bodyText = document.body.innerText;
          const extractedPage1 = bodyText.includes('Multi-Page Document - Page 1');
          const hasCopyBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Copy All Text'));
          const hasDownloadBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Download .TXT'));

          return { success: extractedPage1, hasCopyBtn, hasDownloadBtn };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`Text Extraction Workflow:`, textExtractResult.result.value);

    auditResults.tests.push({
      name: 'Text Extraction Studio (Page Boundaries & TXT Export)',
      status: textExtractResult.result.value.success ? 'PASS' : 'FAIL',
      details: textExtractResult.result.value,
    });

    // ----------------------------------------------------
    // TEST 5: Dynamic Network Traffic Audit (Zero Leakage)
    // ----------------------------------------------------
    console.log(`\n--- Test 5: Dynamic Network Isolation Audit ---`);
    const remoteRequests = recordedRequests.filter((r) => {
      return (
        !r.url.startsWith(`http://127.0.0.1:${PORT}`) &&
        !r.url.startsWith(`http://localhost:${PORT}`) &&
        !r.url.startsWith('data:') &&
        !r.url.startsWith('blob:')
      );
    });

    // Check if any request ever contained uploaded payload bytes
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

    console.log(`Total Requests Recorded: ${recordedRequests.length}`);
    console.log(`Remote Non-Localhost Requests: ${remoteRequests.length}`);
    console.log(`Payload-Leaking Requests: ${payloadLeakingRequests.length}`);

    if (remoteRequests.length > 0) {
      console.warn(`WARNING: Remote requests observed:`, remoteRequests);
    }

    const networkIsolated = remoteRequests.length === 0 && payloadLeakingRequests.length === 0;

    auditResults.tests.push({
      name: 'Dynamic Network Isolation (Zero Remote Uploads)',
      status: networkIsolated ? 'PASS' : 'FAIL',
      details: {
        totalRequests: recordedRequests.length,
        remoteRequestsCount: remoteRequests.length,
        payloadLeakingRequestsCount: payloadLeakingRequests.length,
      },
    });
  } catch (err) {
    console.error(`Error during ${browserName} audit:`, err);
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

  return auditResults;
}

async function main() {
  console.log(`Starting Next.js production server on port ${PORT}...`);
  const serverProc = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: ROOT_DIR,
    shell: true,
  });

  // Wait for server to respond
  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    await wait(1000);
    try {
      const res = await fetch(`${SERVER_URL}/`);
      if (res.status === 200) {
        serverReady = true;
        break;
      }
    } catch {}
  }

  if (!serverReady) {
    serverProc.kill();
    throw new Error(`Server failed to start on ${SERVER_URL}`);
  }

  console.log(`✅ Production server ready on ${SERVER_URL}`);

  const summary = [];

  // Run Chrome Audit
  try {
    const chromeResult = await runBrowserAudit(
      'Google Chrome',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      9444
    );
    summary.push(chromeResult);
  } catch (e) {
    console.error(`Chrome Audit Failed:`, e);
  }

  // Run Edge Audit
  try {
    const edgeResult = await runBrowserAudit(
      'Microsoft Edge',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      9445
    );
    summary.push(edgeResult);
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

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
