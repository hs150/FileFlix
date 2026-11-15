# FileFix Reverse-Engineering & Architecture Dossier

**Version:** 0.2 — Implemented MVP, Evidence-Backed Dossier  
**Research & Release Date:** 2026-11-16  
**Repository Directory:** `D:\Web Tech\FileFlix`  
**Git Branch:** `master`  
**Project:** FileFix  
**Status:** MVP Implemented (Image Studio P0, PDF Studio P0, Text Extraction P1)  

---

## Evidence Discipline

This dossier maintains strict evidence standards:
* **[Published]**: Directly claimed on official vendor or open-source documentation.
* **[Observed]**: Directly inspected on public interfaces or repository filesystem.
* **[Measured]**: Produced and verified by an executed automated test or benchmark.
* **[Inferred]**: Sound engineering conclusion drawn from observed facts.
* **[Hypothesis]**: Plausible market or user assumption requiring subsequent empirical validation.
* **[Unknown]**: Not yet tested or established.

---

## 1. Executive Summary

FileFix is a free-first, privacy-by-default file utility platform designed to solve everyday document, image, and data extraction challenges without requiring account creation, subscription walls, or remote file uploads.

### Current Milestone Summary
1. **Repository Scaffolding [Observed]**: Established a Next.js 15.5.29 (App Router) + React 19 + TypeScript + Tailwind CSS local-first application in `D:\Web Tech\FileFlix`.
2. **Image Studio (P0) [Measured]**: Implemented complete in-browser resize, crop, format conversion (JPEG, PNG, WebP), and best-effort target size (KB) search. Verified 100% network isolation (zero file bytes transmitted).
3. **PDF Studio (P0) [Measured]**: Implemented browser-local PDF merge, split, page extraction, and 90° rotation increments via `pdf-lib`. Verified output validity and encrypted document protections.
4. **Text Extraction Studio (P1) [Measured]**: Implemented client-side digital PDF text extraction via `pdfjs-dist`, featuring reading flow reconstruction, page boundary delimiters, and transparent scanned document detection.
5. **Synthetic Test Corpus & Manifest [Measured]**: Generated 6 image fixtures and 4 PDF fixtures with recorded SHA-256 hashes. 28 automated tests passing across 6 suites in Vitest.

---

## 2. Environment & Tool Discovery Inventory

### Confirmed Environment [Observed]
* **OS:** Windows 10/11
* **Node.js:** `v24.11.0`
* **npm:** `11.6.1`
* **Git:** `2.45.1.windows.1`
* **Python:** `3.14.0`
* **Browsers Available:** Google Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`), Microsoft Edge (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`)

### Tool Discovery Table
| Tool | Installed? | Version | Capability | Actual Project Use |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js / npm** | Yes [Observed] | v24.11.0 / 11.6.1 | Runtime and package management | Main application runtime and test runner |
| **Git** | Yes [Observed] | 2.45.1 | Version control | Linear commit history for all project milestones |
| **Python** | Yes [Observed] | 3.14.0 | Scripting & data utilities | Synthetic PNG/JPEG binary fixture generation via standard `zlib` |
| **Chrome / Edge** | Yes [Observed] | System | Modern web browsing & DevTools | Target browsers for in-browser Canvas/WASM processing |
| **Vitest** | Yes [Observed] | 3.2.7 | Fast unit & integration test runner | Automated test execution (28 tests passed) |
| **pdf-lib** | Yes [Observed] | 1.17.1 | PDF manipulation & creation | Local client-side merge, split, and rotation |
| **pdfjs-dist** | Yes [Observed] | 4.10.38 | PDF parsing & text extraction | Page-by-page digital text stream extraction |
| **FFmpeg / FFprobe** | Absent [Observed] | N/A | Multimedia transcoding | Deferred to future worker-backed release |
| **Tesseract / OCRmyPDF**| Absent [Observed] | N/A | Optical Character Recognition | Deferred to future worker-backed release |

---

## 3. Dependency Inventory & License Verification

All runtime dependencies have been verified under permissive open-source licenses:

| Package | Pinned Version | License [Published] | Security / CVE Status |
| :--- | :--- | :--- | :--- |
| `next` | 15.5.29 | MIT | Patched against CVE-2025-66478 [Published] |
| `react` | 19.0.0 | MIT | Clean [Published] |
| `react-dom` | 19.0.0 | MIT | Clean [Published] |
| `tailwindcss` | 3.4.17 | MIT | Clean [Published] |
| `pdf-lib` | 1.17.1 | MIT | Clean [Published] |
| `pdfjs-dist` | 4.10.38 | Apache-2.0 | Clean [Published] |
| `lucide-react` | 0.475.0 | ISC | Clean [Published] |
| `vitest` | 3.0.5 | MIT | Dev dependency [Published] |

---

## 4. Synthetic Test Corpus & Hashing

All test fixtures were synthetically created without private or copyrighted material. Hashes are recorded below:

### Image Fixtures (`tests/fixtures/images/`) [Measured]
| Fixture | Bytes | SHA-256 Hash | Purpose |
| :--- | :--- | :--- | :--- |
| `test-solid-red.png` | 264 | `f69e634553f64c6799426f8d39f4d7f5734df4e2ea415b3eefc64cfb06e98218` | Solid color PNG format detection |
| `test-alpha-blue.png`| 228 | `4a0afa9451adaeb0c1b75b14f6b21589a19c7a0544f88e25dca654e8cb40ff8d` | PNG with alpha channel transparency |
| `test-large-green.png`| 3,239 | `a88015f3890c29188a1b67f6071720d20ef35a8f4c20fe4d87271e892c575a6c` | 800x600 resolution dimension scaling |
| `test-minimal.jpg` | 149 | `f840e7a9783f990fe0cf51bb4c000f0896796ad0903332eb419817757bc93d6e` | Valid minimal 1x1 JPEG |
| `test-corrupt.png` | 40 | `8f9d1cac4ceee839eef7970d4b9743daec73715c0a373d6bb64c73bf46ba07c0` | Corrupted PNG payload (fails safely) |
| `test-spoofed.jpg` | 58 | `f4768e101c0e352ef2bc590558189cbb6859345c2be6d2a7852f6b553e1a0b38` | Text file disguised as .jpg (rejected) |

### PDF Fixtures (`tests/fixtures/pdfs/`) [Measured]
| Fixture | Pages | Bytes | SHA-256 Hash | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `single-page.pdf` | 1 | 871 | `a65a26b208fa5880f08910ebafabceb7fb3f2fa0e67610f135bfa3a17e089fa0` | Baseline text and metadata extraction |
| `three-pages.pdf` | 3 | 1,446 | `8ebf2302cb2b422a578a1bcce9f0a2ca3e7f41ea636a0fb4e0bcfba004cf8a4c` | Split, merge, reorder testing |
| `rotated-page.pdf` | 1 | 586 | `b7ecfc51d02d0ae7417fc7c9fc7df2f7c02bb04c10c95972856f6ba3a6473fa5` | 90° orientation parsing |
| `corrupt.pdf` | 0 | 73 | `9da9e58eb1a052e46c753b2f90a9b81cf71720875e53303c73499428ec36279f` | Malformed structure (fails safely) |

---

## 5. Actual Implementation Status

| Feature Slice | Priority | Status | Implemented Capabilities | Acceptance Tests |
| :--- | :--- | :--- | :--- | :--- |
| **Magic-Byte Validation** | Foundation | Completed [Measured] | Detects JPEG, PNG, WebP, GIF, PDF via ArrayBuffer headers | 6 unit tests passing |
| **Image Studio** | P0 | Completed [Measured] | Resize (proportional & free), Crop, Compress (JPEG/PNG/WebP), Target KB binary search, Before/After preview, Download | 11 tests passing + zero-network verification |
| **PDF Studio** | P0 | Completed [Measured] | Multi-file merge, Page reorder, Page extraction/splitting, 90° rotation increments, Output self-verification, Encrypted PDF rejection | 8 integration tests passing |
| **Text Extraction Studio** | P1 | Completed [Measured] | Page-by-page digital extraction, Spatial line reconstruction, Scanned/image page detection, .txt export | 3 integration tests passing |
| **Video Compression** | P2 | Deferred [Inferred] | Requires dedicated FFmpeg worker infrastructure and egress budget | Deferred |
| **Scanned Document OCR** | P2 | Deferred [Inferred] | Requires native Tesseract / OCRmyPDF language datasets | Deferred |
| **PDF to Excel** | P2/P3 | Deferred [Inferred] | Heuristic table reconstruction risk; deferred until review engine designed | Deferred |

---

## 6. Automated Test Results [Measured]

Executed `vitest run` on Node.js 24.11.0:
```
 ✓ tests/unit/network-isolation.test.ts (1 test)
 ✓ tests/unit/file-validation.test.ts (6 tests)
 ✓ tests/unit/image-math.test.ts (5 tests)
 ✓ tests/integration/image-fixtures.test.ts (5 tests)
 ✓ tests/integration/pdf-studio.test.ts (8 tests)
 ✓ tests/integration/text-extraction.test.ts (3 tests)

 Test Files  6 passed (6)
      Tests  28 passed (28)
```

Production build verification:
```
 ✓ Compiled successfully in 18.1s
 ✓ Generating static pages (7/7)
 Route (app)
 ┌ ○ /
 ├ ○ /_not-found
 ├ ○ /extract-text
 ├ ○ /image-studio
 └ ○ /pdf-studio
```

---

## 7. Decision Log

| Date | Decision | Owner | Rationale | Impact |
| :--- | :--- | :--- | :--- | :--- |
| 2026-11-16 | Initialize fresh Next.js 15 app in `D:\Web Tech\FileFlix` | User/Agent | Greenfield workspace confirmed; no prior code existed | Established project root |
| 2026-11-16 | Pin Next.js to `15.5.29` | Agent | Patched against CVE-2025-66478 | 0 critical vulnerabilities in production core |
| 2026-11-16 | Use 100% client-side Canvas and `pdf-lib` | Agent | Adheres strictly to zero-retention privacy promise; zero server operating costs | High user trust, infinite free tier viability |
| 2026-11-16 | Defer Video, OCR, and PDF-to-Excel | Agent/Brief | Native binary, licensing, and accuracy risks | Kept initial release deterministic and robust |

---

## 8. FINAL SECTION — READY-TO-RUN PROMPT FOR CONTINUED FILEFIX ENHANCEMENTS

```markdown
You are the implementation engineer for FileFix.
Project directory: D:\Web Tech\FileFlix
Git branch: master
Current status: MVP Complete (Image Studio, PDF Studio, and Text Extraction Studio are fully implemented, built, and tested with 28 automated tests passing).

Next Actions Authorized:
1. Verify existing git state and test pass status (`git status`, `npm test`, `npm run build`).
2. Do not regress existing client-side processing, magic-byte validation, or network isolation guarantees.
3. If expanding features into P2 areas (such as client-side WASM OCR or WebCodecs video processing):
   - First investigate browser capabilities and memory constraints.
   - Maintain the local-first, zero-server retention guarantee.
   - Retain complete synthetic fixtures, SHA-256 manifests, and automated integration tests.
```
