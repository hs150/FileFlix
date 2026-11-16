# FileFix

> **Fix, convert, compress, and organize everyday files with zero upload privacy.**  
> 100% client-side, local-first file utility platform built with Next.js, React, TypeScript, and Tailwind CSS.

---

## 🔒 Privacy-by-Default Architecture

Unlike traditional file conversion utilities that upload private documents to remote cloud servers, **FileFix performs 100% of its computation directly inside the user's browser sandbox**:
- **Zero Server Uploads**: No file bytes, document streams, or extracted text ever leave your device.
- **Client-Side Validation**: Multi-stage magic-byte and syntax validation verifies authentic file headers, preventing extension spoofing.
- **Resource Discipline**: Automatic in-memory buffer cleanup and `URL.revokeObjectURL` handlers prevent memory leaks during repeated usage.
- **No Paywalls or Accounts**: Direct access to high-intent tools without authentication or subscription gates.

---

## 🛠 Implemented Studios & Utilities

### 1. Universal File Conversion Hub (`/convert-files`) — Live
A unified, extensible client-side conversion engine governed by a single capability registry with multi-stage format detection and container disambiguation (distinguishing ZIP, EPUB, XLSX, and CBZ containers).
* **Category 1: Archive Converters (P0 Implemented)**:
  * Bidirectional transformations between **ZIP**, **TAR**, **GZIP**, and **TAR.GZ**.
  * Pure TypeScript POSIX ustar TAR creation and extraction engine.
  * Comprehensive security guards: Zip Slip path traversal defense (`../`, absolute paths, Windows reserved device names `CON`, `NUL`, `PRN`) and decompression bomb limits (`MAX_ENTRIES = 1000`, `MAX_TOTAL_EXPANDED_BYTES = 100 MB`, `MAX_COMPRESSION_RATIO = 100:1`).
* **Category 2: Data & Spreadsheet Converters (P0 Implemented)**:
  * Bidirectional conversions between **CSV**, **TSV**, **JSON**, **JSONL (NDJSON)**, **XML**, **YAML**, and **XLSX**.
  * RFC 4180 parsing with delimiter autodetection (`,`, `\t`, `;`, `|`).
  * **Formula Injection Defense**: Neutralizes DDE command execution in Excel/Sheets by prepending an apostrophe `'` to cell values starting with `=`, `+`, `-`, `@`, `\t`, or `\r`.
  * Pure browser OpenXML (.xlsx) generation and extraction via `fflate`.
  * XML parsing with XXE defense (blocks `<!DOCTYPE ... SYSTEM>`, external entities).
* **Category 3: Vector Graphics Converters (P0 Implemented)**:
  * Transformations: **SVG $\rightarrow$ PNG / JPEG / WebP / ICO / PDF**, and **PNG / JPEG $\rightarrow$ ICO**.
  * **SVG Security Sanitizer**: Strips `<script>`, inline event handlers (`onload`, `onclick`), `javascript:` URIs, remote network URLs in `href`/`xlink:href`, and `<foreignObject>`.
  * **Windows ICO Binary Encoder**: Produces authentic `00 00 01 00` ICONDIR headers, 16-byte ICONDIRENTRY directory tables, and PNG-compressed icon resources across standard resolutions (16 to 256 px).
* **Category 4: eBook & Comic Converters (P0 Implemented)**:
  * Transformations: **TXT / HTML $\rightarrow$ EPUB**, **EPUB $\rightarrow$ TXT**, and **CBZ $\rightarrow$ PDF**.
  * **W3C EPUB 3.3 Compliant Package Generator**: Uncompressed `mimetype` at byte offset 0 (`STORED`), `META-INF/container.xml`, `content.opf`, `nav.xhtml`, `chapter1.xhtml`, and `styles.css`.
  * **EPUB Spine Extractor**: Sequentially extracts linear text in reading order.
  * **Honest DRM Disclosure**: Rejects encrypted files (`META-INF/encryption.xml`) with a transparent copyright advisory.
  * **Comic Book Packager**: Unpacks comic page images in natural order and compiles them into a clean multi-page PDF via `pdf-lib`.

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

The project includes **97 automated tests across 16 test suites**:
* `tests/unit/universal-conversion-engine.test.ts`: Verifies capability registry lookups, format discovery, and unified execution.
* `tests/integration/archive-conversions.test.ts`: Tests ZIP $\leftrightarrow$ TAR, TAR.GZ extraction, and Zip Slip path traversal defenses.
* `tests/integration/data-conversions.test.ts`: Tests CSV $\leftrightarrow$ JSON, formula injection escaping, YAML, XML XXE rejection, and OpenXML XLSX generation.
* `tests/integration/vector-conversions.test.ts`: Tests SVG sanitization, XSS blocking, and authentic Windows ICO binary encoding.
* `tests/integration/ebook-conversions.test.ts`: Tests W3C EPUB 3.3 packaging, chapter extraction, DRM detection, and CBZ comic packager.
* `tests/unit/network-isolation.test.ts`: Verifies zero outbound network calls in Image Studio, Converter, and Universal Conversion pipelines.
* `tests/unit/conversion-registry.test.ts`: Verifies registry metadata, format statuses, MIME mappings, and lookup utilities.
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
* `fflate` (0.8.2) — MIT
* `js-yaml` (4.1.0) — MIT
* `pdf-lib` (1.17.9) — MIT
* `pdfjs-dist` (4.10.38) — Apache-2.0
* `lucide-react` (0.475.0) — ISC
* `vitest` (4.1.12) — MIT

- **`npm audit` Status**: **0 vulnerabilities**.

---

## 📜 License
Independent clean-room implementation for FileFix.
