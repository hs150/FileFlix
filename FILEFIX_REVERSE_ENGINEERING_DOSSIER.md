# FileFix Reverse-Engineering & Architecture Dossier

**Version:** 0.6 — Application Studio Implemented, Official Government Presets Hardened & Cross-Browser Verified  
**Research, Audit & Implementation Date:** 2026-11-16  
**Repository Directory:** `D:\Web Tech\FileFlix`  
**Git Branch:** `main` (tracking `origin/main`)  
**Project:** FileFix  
**Status:** MVP Implemented (v0.4); Planning Finalized (v0.5); Application Studio Fully Implemented, Audited & Verified (v0.6)  

---

## Evidence Discipline

This dossier maintains strict, transparent evidence discipline across all sections:
* **[Published]**: Directly claimed on official vendor, government, or open-source documentation.
* **[Observed]**: Directly inspected on public web interfaces, local filesystem, or system runtime.
* **[Measured]**: Produced and verified by an executed automated test, browser automation script, or live benchmark.
* **[Inferred]**: Sound engineering conclusion drawn directly from observed facts.
* **[Hypothesis]**: Plausible market or user assumption requiring subsequent empirical validation.
* **[Unknown]**: Explicitly unverified, untested, or not publicly documented.

---

## 1. Executive Summary

FileFix is designed as a free-first, self-service file utility platform built on an absolute privacy-by-default architecture: solve everyday image optimization, document organization, official application preparation, and text extraction problems directly inside the user's web browser without requiring accounts, paywalls, or remote file uploads.

### Version 0.6 Milestone Highlights
1. **Application Studio Implementation (`/application-studio`) [Measured]**:
   - Built a dedicated, user-facing application preparation studio implementing versioned official presets (`APPLICATION_PRESETS_VERSION = '1.0.0'`).
   - Reused existing Web Worker image engine (`image.worker.ts`) and mathematical fitting algorithms without adding external dependencies or backend services.
   - Introduced user-controlled aspect-ratio fitting: **Center Crop** (crops outer margins to fill the exact required aspect frame) and **Pad with White** (scales entire image to fit inside target dimensions on a clean white background, essential for signatures).
   - Preserves original signatures without automatic stroke modification, retracing, or binarization distortion.
   - Implemented an automated **Technical Compliance Engine** that validates actual output pixel width, pixel height, aspect ratio tolerance ($\le 5\%$), file size boundaries, and MIME format against official portal rules.
   - Added prominent **Biometric & Integrity Disclaimers** distinguishing technical compliance from visual/biometric acceptance (eye height, background lighting, neutral expression) and explicitly warning users when official authorities require original, unedited photographs.
   - Provided one-click export of processed images and a downloadable structured compliance report (`.txt`).
2. **Automated Test Suite Expansion [Measured]**:
   - Expanded Vitest test coverage from 29 tests across 6 files to **53 automated tests across 8 test files**, all passing with exit code 0 (`npm test`).
   - Added `tests/unit/application-presets.test.ts` (15 unit tests covering preset catalog integrity, boundary rules, and aspect math).
   - Added `tests/integration/application-studio.test.ts` (9 integration tests verifying boundary enforcement, file size limits, and format prohibitions).
3. **Cross-Browser Verification across Chrome & Edge [Measured]**:
   - Automated CDP verification on **Google Chrome (`157.0.8103.51`)** and **Microsoft Edge (`157.0.4341.60`)** achieved a **100% PASS** rate across all 6 test suites.
   - Successfully verified Application Studio workflows: preset switching, alpha-blue PNG upload, center-crop to 600×600 px, JPEG white flattening, compliance card rendering, and download button readiness.
4. **Dynamic Network Isolation Proof [Measured]**:
   - Monitored real-time network traffic during live automation: recorded 111–113 requests per browser. Exactly 97 were local static Next.js assets (`127.0.0.1:3099/_next/...`), with **0 remote requests to external origins**, **0 POST requests**, and **0 user file bytes or text data transmitted**.
   - Full audit log archived at `tests/e2e/network-requests-log.json`.
5. **Dependency Security Resolution [Measured]**:
   - `npm audit` re-verified: **0 vulnerabilities found (Exit code: 0)**.

---

## 2. Official Government Presets Catalog (Version 1.0.0)

All profiles are strictly decoupled and verified against official notifications as of 2026-11-16:

| Preset Identifier | Issuing Authority & Application | Dimensions | File Size Bounds | Format | Verified Rules & Portal Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`us-visa-ds160`** | **U.S. Dept of State (CEAC)**<br>DS-160 Nonimmigrant Visa | 600×600 px min to<br>1200×1200 px max (1:1) | $\le 240\text{ KB}$<br>(no official min floor) | JPEG | 24-bit sRGB; compression ratio $\le 20:1$; plain white/off-white background; original unedited photo required within last 6 months. |
| **`us-passport-renewal`** | **U.S. Dept of State (CA)**<br>Online Passport Renewal (OPR) | 600×600 px min to<br>1200×1200 px max (1:1) | **54 KB to 10 MB**<br>(strict official floor & ceiling) | JPEG / PNG | Official warning: rules strictly state *"Do not use software-edited, digitally altered, filtered, or AI-enhanced photographs."* Technical compliance only. |
| **`schengen-visa-france`** | **France-Visas / Min. Intérieur**<br>Digital Upload Portal (ICAO 9303) | 413×531 px<br>(35×45 mm at 300 DPI, 7:9) | $\le 300\text{ KB}$<br>(portal maximum ceiling) | JPEG | Light grey or light blue background (plain white often rejected); face height must occupy 70–80% of frame (32–36 mm). |
| **`upsc-exam-photo`** | **UPSC, India**<br>One Time Registration (OTR) / Exam | 350×350 px min to<br>1000×1000 px max (1:1) | **20 KB to 200 KB**<br>(strict portal boundaries) | JPEG | Automated portal upload rejects files $<20\text{ KB}$ or $>200\text{ KB}$. Note: check notification as some stages now require live webcam capture. |
| **`upsc-exam-signature`** | **UPSC, India**<br>One Time Registration (OTR) / Exam | 350×350 px min to<br>1000×1000 px max (1:1) | **20 KB to 100 KB**<br>(strict portal boundaries) | JPEG | Default pad-with-white fitting; transparent PNG flattened to pure white; black/dark blue ink on white paper; no stroke thinning. |
| **`ssc-exam-signature`** | **Staff Selection Commission (SSC)**<br>SSC Online Portal / OTR | **140 × 60 px**<br>(aspect ratio 7:3) | **10.0 KB to 20.0 KB**<br>(strict portal boundaries) | JPEG | **CRITICAL SSC NOTICE**: SSC candidate photographs must be captured live via webcam or MySSC mobile app. Only candidate SIGNATURES are uploaded as files. |
| **`custom-application`** | **User-Defined**<br>General Portals / Universities | Configurable<br>(default 600×600 px) | Configurable<br>(default $\le 100\text{ KB}$) | JPEG / PNG / WebP | Fully user-controlled dimensions and KB boundaries for unlisted portals. |

---

## 3. Dependency Security & License Audit

Vulnerability status, installation consistency, and license compliance are reported separately below:

### A. Vulnerability Status (`npm audit`) [Measured]
* **Mitigation Status:** Non-breaking package overrides in `package.json` (`postcss@^8.5.33`, `tinypool@^2.2.0`, `minimatch@^11.0.8`, `vitest@^4.1.12`).
* **Audit Result:** `found 0 vulnerabilities` (Exit code: 0).

### B. Dependency Installation Status (`npm ls --depth=0`) [Measured]
All runtime and development packages resolve cleanly without missing packages:
* `next@15.5.29`, `react@19.0.0`, `react-dom@19.0.0`, `pdf-lib@1.17.1`, `pdfjs-dist@4.10.38`, `lucide-react@0.475.0`, `tailwindcss@3.4.17`, `typescript@5.7.3`, `vitest@4.1.12`, `eslint@9.39.5`.

### C. Open-Source License Compliance [Published / Observed]
All runtime packages are licensed under permissive open-source licenses: Next.js (MIT), React (MIT), pdf-lib (MIT), pdfjs-dist (Apache-2.0), Lucide React (ISC), Tailwind CSS (MIT).

---

## 4. Dynamic Network Isolation Evidence

Dynamic network monitoring was conducted during active browser automation using native Chrome DevTools Protocol (`Network.enable` and `Network.requestWillBeSent`).

### Request Audit Metrics [Measured]

| Metric | Google Chrome (`157.0.8103.51`) | Microsoft Edge (`157.0.4341.60`) | Verdict |
| :--- | :---: | :---: | :---: |
| **Total Requests Recorded** | 113 | 111 | `PASS` |
| **Local Static Asset Requests (`127.0.0.1:3099`)** | 97 | 97 | `PASS` |
| **Internal Browser Scheme Requests (`chrome://`, etc.)** | 16 | 14 | `PASS` |
| **Remote HTTP / HTTPS External Requests** | **0** | **0** | `PASS` |
| **HTTP POST / PUT / PATCH Requests** | **0** | **0** | `PASS` |
| **Requests Containing File or Binary Payloads** | **0** | **0** | `PASS` |
| **Requests Containing Extracted Text Payloads** | **0** | **0** | `PASS` |

### Audit Clarifications & Methodology [Measured]
1. **Per-Browser Scoping**: Request counts are tracked in independent arrays instantiated per browser session. Both Chrome and Edge executed the complete 5-page sequence (`/` $\rightarrow$ `/image-studio` $\rightarrow$ `/pdf-studio` $\rightarrow$ `/extract-text` $\rightarrow$ `/application-studio`). The 97 local requests represent static Next.js JavaScript chunks, CSS stylesheets, and pre-rendered route HTML.
2. **Payload Inspection**: The request listener inspected `hasPostData` and `postData` strings for all outgoing traffic. Zero requests carried file signatures (`JFIF`, `PNG`, `PDF`) or extracted document strings.
3. **Download Generation**: All user downloads are triggered via client-side `URL.createObjectURL(blob)`. Blob contents are generated directly in browser memory via Web Worker / Canvas `convertToBlob()` or `pdf-lib` / `pdfjs-dist` ArrayBuffer serialization, proving downloads are 100% local.
4. **Log Archive**: Complete request-by-request metadata is exported to [tests/e2e/network-requests-log.json](file:///d:/Web%20Tech/FileFlix/tests/e2e/network-requests-log.json).

---

## 5. Cross-Browser Automated Verification Results

Automated end-to-end testing was conducted via [tests/e2e/browser-audit.mjs](file:///d:/Web%20Tech/FileFlix/tests/e2e/browser-audit.mjs). Full execution results are recorded in [tests/e2e/browser-audit-report.json](file:///d:/Web%20Tech/FileFlix/tests/e2e/browser-audit-report.json):

| Test Category | Tested Operations & Assertions | Google Chrome | Microsoft Edge | Verdict |
| :--- | :--- | :---: | :---: | :---: |
| **1. Home Page Navigation** | Title verification, active route links to all 4 studios (Image, Application, PDF, Text). | `PASS` | `PASS` | `PASS` |
| **2. Image Studio** | • Solid PNG upload & metadata (`120×80`)<br>• OffscreenCanvas resize & blob export (454 bytes, `89 50 4E 47`)<br>• Transparent PNG $\rightarrow$ JPEG conversion (785 bytes, `FF D8 FF`, white flattening)<br>• Real EXIF JPEG Orientation 6 parsing (`test-exif-orientation-6.jpg`)<br>• Target-size binary search (achieved 12 KB $\le$ 50 KB target)<br>• Spoofed file rejection (magic bytes). | `PASS` | `PASS` | `PASS` |
| **3. PDF Studio** | • Multi-file merge (`single-page.pdf` + `three-pages.pdf`)<br>• File reordering via UI controls<br>• Output verified with 4 pages<br>• Organize mode: rotate all (+90°)<br>• Page extraction/split (deselect page 2 $\rightarrow$ export 2 pages)<br>• Corrupt PDF structural rejection. | `PASS` | `PASS` | `PASS` |
| **4. Text Extraction Studio** | • Multi-page digital PDF parsing (`three-pages.pdf`)<br>• Page boundary detection (`--- Page 1 of 3 ---`)<br>• Multi-page navigation (Page 1 $\rightarrow$ Page 2)<br>• Copy All Text button readiness<br>• Download .TXT export validation. | `PASS` | `PASS` | `PASS` |
| **5. Application Studio** | • Preset catalog selection (`us-visa-ds160`, `us-passport-renewal`, `schengen-visa-france`, `upsc-exam-photo`, `upsc-exam-signature`, `ssc-exam-signature`)<br>• Center-crop to 600×600 px square<br>• Transparent PNG JPEG flattening (2,928 bytes $\le$ 240 KB)<br>• Technical compliance checks (Width, Height, Aspect Ratio, File Size, Format)<br>• Biometric disclaimer & unedited photo advisory<br>• Download Image & Export Report (.txt) buttons. | `PASS` | `PASS` | `PASS` |
| **6. Dynamic Network Isolation** | • Zero remote HTTP/HTTPS requests<br>• Zero POST requests<br>• Zero user data transmitted outside localhost. | `PASS` | `PASS` | `PASS` |

---

## 6. Updated Product Roadmap & Backlog Status

Following the successful implementation and verification of **Application Studio (Rank 1)**, the remaining backlog stands as follows:

```
[Rank 1: Application Studio Presets & Validation]  ✅ COMPLETED (v0.6)
       │
       ▼
[Rank 2: PDF Studio Visual Page Thumbnails]        ⏳ NEXT UP (v0.7)
       │
       ▼
[Rank 3: Image Studio Interactive Visual Crop]     ⏳ PLANNED (v0.8)
       │
       ▼
[Rank 4: Installable Offline PWA Support]          ⏳ PLANNED (v0.9)
       │
       ▼
[Rank 5: Image Studio Multi-Image Batch & ZIP]     ⏳ PLANNED (v1.0)
```

1. **Rank 1 — Application Studio Official Presets & Validation** *(v0.6)*: **COMPLETE**
   - Implemented at `/application-studio` with 6 official decoupled presets + custom profile.
   - Center-crop and pad-white fitting algorithms implemented.
   - Comprehensive compliance validation and report export.
2. **Rank 2 — PDF Studio Visual Page Thumbnails** *(Target: v0.7)*:
   - Low-resolution visual canvas preview for each page in Organize mode using `pdfjs-dist` `page.render()`.
   - Concurrency queue (max 2 concurrent renders) to prevent memory pressure.
3. **Rank 3 — Image Studio Interactive Visual Crop Box** *(Target: v0.8)*:
   - Mouse/touch draggable crop handles overlaying the preview canvas.
   - Aspect ratio locking (1:1, 4:3, 16:9, 7:9).
4. **Rank 4 — Installable Offline PWA Support** *(Target: v0.9)*:
   - Web App Manifest (`manifest.webmanifest`) and Service Worker with Cache API pre-caching static Next.js assets.
   - Dynamic offline execution test via automated CDP.
5. **Rank 5 — Image Studio Multi-Image Batch Queue & Client-Side ZIP Export** *(Target: v1.0)*:
   - Multi-file ingestion, parallel worker execution queue, and in-browser `.zip` generation via JSZip.

---

## 7. Formal Audit Scorecard

| Requirement | Audit Verdict | Evidence & Details |
| :--- | :---: | :--- |
| **1. Protect current implementation** | `PASS` | All features preserved; 8 linear git commits on branch `main`. |
| **2. TypeScript type checking** | `PASS` | `npx tsc --noEmit` passed with 0 errors. |
| **3. ESLint compliance** | `PASS` | 0 warnings, 0 errors (`npm run lint`). |
| **4. Vitest automated tests** | `PASS` | **53 automated tests passing across 8 test suites** (`npm test`, exit code 0). |
| **5. Production build** | `PASS` | `npm run build` compiled in 4.7s; 8 static pages generated cleanly. |
| **6. Dependency security audit** | `PASS` | Diagnosed and mitigated transitive vulnerabilities; `npm audit` reports 0 vulnerabilities. |
| **7. Image Studio browser workflows** | `PASS` | Tested in Chrome 157 & Edge 157: upload, resize, crop, format conversion, EXIF, target KB, spoof rejection. |
| **8. PDF Studio browser workflows** | `PASS` | Tested in Chrome 157 & Edge 157: multi-file upload, 4-page merge, page reorder, rotation, split, corrupt rejection. |
| **9. Text Extraction Studio workflows** | `PASS` | Tested in Chrome 157 & Edge 157: digital extraction, page boundaries, page tabs, TXT download. |
| **10. Application Studio workflows** | `PASS` | Tested in Chrome 157 & Edge 157: official presets, center-crop, pad-white, compliance card, download & report. |
| **11. Dynamic network isolation** | `PASS` | CDP recorded 111–113 requests across Chrome & Edge: 0 remote, 0 POST, 0 data-leaking. Full log archived. |
| **12. Web Worker offloading** | `PASS` | Dedicated `image.worker.ts` with `OffscreenCanvas` and main-thread fallback; ~1800ms latency. |
| **13. EXIF orientation handling** | `PASS` | Verified with synthetic JPEG containing APP1 Exif marker with Orientation 6. |
| **14. Transparency / JPEG flattening** | `PASS` | Solid white background fill applied when converting transparent PNGs to JPEG; verified `FF D8 FF`. |
| **15. Decoupled official presets** | `PASS` | US Visa, US Passport, France-Visas, UPSC Photo, UPSC Sig, SSC Sig each have verified URLs and independent rules. |
| **16. Biometric vs technical compliance** | `PASS` | Clear separation between mathematical parameters (px, bytes, format) and biometric acceptance. |
| **17. Original unedited warnings** | `PASS` | Official notices displayed for passport and visa profiles requiring unedited photographs. |
| **18. Signature stroke preservation** | `PASS` | Zero automatic binarization, retracing, or thinning; user-controlled padding and compression. |
| **19. SSC photo policy distinction** | `PASS` | Explicitly informs users that SSC requires live camera capture for photos and only accepts signatures as files. |
| **20. Zero server retention** | `PASS` | 100% in-browser processing verified via CDP request inspection. |

---

## 8. Ready-to-Run Next Phase Prompt

```markdown
You are the lead full-stack engineer and product architect for FileFix.
Project directory: D:\Web Tech\FileFlix
Git branch: main
Current status: Application Studio Implemented & Cross-Browser Verified (Version 0.6 Dossier finalized; 0 npm audit vulnerabilities; 53 Vitest tests passing; Chrome 157 and Edge 157 browser verification complete with 0 remote network traffic; Rank 1 milestone complete).

Next Authorized Milestone: Rank 2 — PDF Studio Visual Page Thumbnails
Scope:
1. Render low-resolution canvas previews for each page in PDF Studio Organize mode using pdfjs-dist.
2. Maintain local-only in-browser execution with concurrency bounds (max 2 concurrent renders).
3. Update interactive page cards to display live thumbnails, page numbers, and rotation status.
```
