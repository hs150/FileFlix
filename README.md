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

## 🛠 Implemented Studios & Utilities

### 1. Multi-Format File Conversion Hub (`/convert-files`) — Live
* **Conversion Capability Registry**: Centralized, verified registry defining input/output MIME, engines, lossiness, transparency handling, and limits. Never claims universal any-to-any; never merely renames file extensions.
* **Image Conversions**: Bidirectional conversions between JPEG, PNG, and WebP via Canvas 2D and Web Workers.
* **Transparency Flattening**: Solid white background fill (`#ffffff`) when converting transparent PNG/WebP images to JPEG, with explicit user warnings.
* **Images to PDF**: Single and batch multi-image to PDF generation (`pdf-lib`) supporting A4, Letter, and Fit-to-Image dimensions, portrait/landscape orientation, and configurable margins.
* **PDF to Images**: High-resolution page rendering to JPEG/PNG (`pdfjs-dist`) at 1x or 2x scale, with page selection and individual or bundled ZIP archive export.
* **Zero-Dependency ZIP Packaging**: Pure TypeScript PKWARE Store-method ZIP archive generator (`src/lib/zip/zip-writer.ts`) with IEEE 802.3 CRC-32 checksums.

### 2. Application Studio (`/application-studio`) — Live
* **Official Government Presets (v2.0.0)**:
  * **U.S. Visa DS-160**: Exact geometric square (1:1, `width === height`, 0 tolerance), 600×600 to 1200×1200 px, $\le 240\text{ KB}$, JPEG.
  * **U.S. Passport Renewal (OPR)**: Checker-only inspection mode (54 KB to 10 MB, JPEG/PNG), prohibiting software alteration.
  * **France / Schengen Visa**: Checker-only inspection mode based on ICAO physical specifications (35×45 mm).
  * **SSC CGL 2026 & CHSL 2026**: Decoupled physical ratios (~2:1 vs ~3:1), 10–20 KB JPEG signature profiles, live webcam notice.
  * **UPSC Generic OTR**: 20–300 KB bounds, 350×350 to 1000×1000 px, 1:1 square.
* **Non-Destructive Aspect Fitting**: User-selected center crop or pad with white background.
* **Multi-Verdict Compliance Reporting**: Generates downloadable audit reports (.txt) distinguishing mathematical technical checks from visual biometric rules.

### 3. Image Studio (`/image-studio`) — Live
* **Resize**: Custom width and height inputs with locked/unlocked aspect ratio and quick scale presets (25%, 50%, 75%, 100%, 150%, 200%).
* **Crop**: Bounding box region selection with boundary clamping.
* **Compression & Conversion**: Encode between JPEG, PNG (lossless with alpha), and WebP formats with adjustable quality (10% to 100%).
* **Target File Size (KB)**: Bounded binary search across encoding parameters, with optional proportional dimension reduction when required.
* **EXIF Orientation**: Automatic normalization of camera rotation tags (Orientation 1–8).
* **Before / After Comparison**: Live visual preview, side-by-side metric comparison, and download handler.

### 4. PDF Studio (`/pdf-studio`) — Live
* **Merge PDFs**: Combine multiple PDF documents in user-specified order with live drag/arrow reordering.
* **Organize, Rotate & Split**:
  * Rotate individual pages or all pages in 90° increments.
  * Extract or split selected page subsets with visual checkboxes.
  * Reorder page sequences.
* **Security & Verification**: Detects and respects encrypted/password-protected PDFs with honest security disclosures. Every exported PDF is re-parsed and validated in memory before download.

### 5. Text Extraction Studio (`/extract-text`) — Live
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

The project includes **70 automated tests across 11 test suites**:
* `tests/unit/network-isolation.test.ts`: Verifies zero outbound network calls exist in the Image Studio and Conversion pipelines.
* `tests/unit/conversion-registry.test.ts`: Verifies registry metadata, verified vs planned statuses, MIME mapping, and lookup utilities.
* `tests/unit/zip-writer.test.ts`: Verifies IEEE 802.3 CRC-32 checksums, standard ZIP header magic bytes (`50 4B 03 04`), EOCD records, and multi-file archive generation.
* `tests/unit/application-presets.test.ts`: Verifies DS-160 exact square rules, U.S. Passport Renewal checker constraints, and SSC CGL vs CHSL dimensional ratios.
* `tests/unit/file-validation.test.ts`: Tests magic-byte header detection for JPEG, PNG, WebP, GIF, PDF, and rejects spoofed files.
* `tests/unit/image-math.test.ts`: Tests aspect ratio math, proportional dimension calculations, and crop box clamping.
* `tests/integration/file-conversions.test.ts`: Tests PNG/JPEG to PDF compilation, multi-image order preservation, spoofed file rejection, and magic byte assertions.
* `tests/integration/application-studio.test.ts`: Tests end-to-end preset processing, center crop, white padding, and compliance report generation.
* `tests/integration/image-fixtures.test.ts`: Tests synthetic image fixtures and verifies manifest integrity.
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
* `vitest` (4.1.12) — MIT

---

## 📜 License
Independent clean-room implementation for FileFix.
