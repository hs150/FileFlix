# FileFix

> **Fix, convert, compress, and organize everyday files with zero upload privacy.**  
> 100% client-side, local-first file utility platform built with Next.js, React, TypeScript, and Tailwind CSS.

---

## 🔒 Privacy-by-Default Architecture

Unlike traditional file conversion utilities that upload private documents to remote cloud servers, **FileFix performs 100% of its computation directly inside the user's browser sandbox**:
- **Zero Server Uploads**: No file bytes, document streams, or extracted text ever leave your device.
- **Client-Side Validation**: Magic-byte content signature validation verifies authentic file headers, preventing extension spoofing.
- **Resource Discipline**: Automatic in-memory buffer cleanup and `URL.revokeObjectURL` handlers prevent memory leaks during repeated usage.
- **No Paywalls or Accounts**: Direct access to high-intent tools without authentication or subscription gates.

---

## 🛠 Implemented Studios (MVP)

### 1. Image Studio (`/image-studio`) — P0
* **Resize**: Custom width and height inputs with locked/unlocked aspect ratio and quick scale presets (25%, 50%, 75%, 100%, 150%, 200%).
* **Crop**: Bounding box region selection with boundary clamping.
* **Compression & Conversion**: Encode between JPEG, PNG (lossless with alpha), and WebP formats with adjustable quality (10% to 100%).
* **Target File Size (KB)**: Best-effort bounded binary search across encoding parameters, with optional proportional dimension reduction when mathematically required.
* **Before / After Comparison**: Live visual preview, side-by-side metric comparison (bytes, dimensions, percentage reduction), and download handler.

### 2. PDF Studio (`/pdf-studio`) — P0
* **Merge PDFs**: Combine multiple PDF documents in user-specified order with live drag/arrow reordering.
* **Organize, Rotate & Split**:
  * Rotate individual pages or all pages in 90° increments.
  * Extract or split selected page subsets with visual checkboxes.
  * Reorder page sequences.
* **Security & Verification**: Detects and respects encrypted/password-protected PDFs with honest security disclosures. Every exported PDF is re-parsed and validated in memory before download.

### 3. Text Extraction Studio (`/extract-text`) — P1
* **Page-by-Page Extraction**: Extracts digital text streams from PDF documents using `pdfjs-dist`.
* **Reading Order Flow**: Reconstructs vertical line breaks from spatial transformation coordinates.
* **Scanned Page Detection**: Detects image-only or low-text pages (< 15 characters) and transparently informs the user that OCR is required.
* **Instant Export**: Copy page, copy all text, or download plain text (`.txt`) file.

---

## 🚀 Quick Start

### Prerequisites
* **Node.js**: `v20.x` or `v24.x` (tested on Node `v24.11.0`)
* **npm**: `v10.x` or `v11.x`

### Installation
```bash
# Clone or navigate to the repository
cd "D:\Web Tech\FileFlix"

# Install dependencies
npm install
```

### Running Development Server
```bash
npm run dev
# Open http://localhost:3000
```

### Running Test Suites
```bash
# Run unit and integration tests via Vitest
npm test
```

### Production Build
```bash
npm run build
npm start
```

---

## 🧪 Automated Test Coverage

The project includes 28 automated tests across 6 suites:
* `tests/unit/network-isolation.test.ts`: Verifies zero outbound network calls (`fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `axios`) exist in the image processing pipeline.
* `tests/unit/file-validation.test.ts`: Tests magic-byte header detection for JPEG, PNG, WebP, PDF, and rejects spoofed extensions.
* `tests/unit/image-math.test.ts`: Tests aspect ratio math, proportional dimension calculations, and crop bounding box clamping.
* `tests/integration/image-fixtures.test.ts`: Tests synthetic image fixtures and verifies SHA-256 manifest integrity.
* `tests/integration/pdf-studio.test.ts`: Tests PDF loading, page count extraction, multi-file merging, page extraction, rotation, and corrupt file rejection.
* `tests/integration/text-extraction.test.ts`: Tests text extraction, page boundary preservation, and scanned page detection.

---

## 📦 Verified Dependency Licenses

All runtime dependencies are verified under permissive open-source licenses:
* `next` (15.5.29) — MIT
* `react` / `react-dom` (19.0.0) — MIT
* `tailwindcss` (3.4.17) — MIT
* `pdf-lib` (1.17.1) — MIT
* `pdfjs-dist` (4.10.38) — Apache-2.0
* `lucide-react` (0.475.0) — ISC
* `vitest` (3.0.5) — MIT

---

## 📜 License
Independent clean-room implementation for FileFix.
