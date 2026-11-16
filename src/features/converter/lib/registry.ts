import { ConversionDefinition } from '../types';

/**
 * FileFix Centralized Conversion Capability Registry
 * 
 * Strict Architectural Rule:
 * Never claim universal any-to-any conversion. Never rename file extensions.
 * Only conversions with verificationStatus === 'VERIFIED_LOCAL' are exposed for active execution.
 */
export const CONVERSION_CAPABILITY_REGISTRY: ConversionDefinition[] = [
  // ==========================================
  // Image Conversions (Phase 1 - Verified Local)
  // ==========================================
  {
    id: 'jpg-to-png',
    name: 'JPEG to PNG',
    description: 'Converts lossy JPEG image to lossless PNG format.',
    category: 'image',
    inputMime: 'image/jpeg',
    outputMime: 'image/png',
    inputExtension: 'jpg',
    outputExtension: 'png',
    engine: 'Canvas 2D / Web Worker',
    isBrowserLocal: true,
    preservesLossless: true,
    preservesTransparency: false,
    preservesAnimation: false,
    maxTestedSizeBytes: 50 * 1024 * 1024,
    knownLimitations: [
      'Cannot recover image details or high-frequency data lost during original JPEG compression.',
      'Output PNG file size is typically significantly larger than source JPEG.',
    ],
    verificationStatus: 'VERIFIED_LOCAL',
    lossinessExplanation:
      'JPEG is inherently lossy. Converting to PNG stops further generational compression loss, but does not reconstruct original uncompressed image frequencies.',
  },
  {
    id: 'png-to-jpg',
    name: 'PNG to JPEG',
    description: 'Converts lossless PNG image to compressed JPEG format with transparency flattening.',
    category: 'image',
    inputMime: 'image/png',
    outputMime: 'image/jpeg',
    inputExtension: 'png',
    outputExtension: 'jpg',
    engine: 'Canvas 2D / Web Worker',
    isBrowserLocal: true,
    preservesLossless: false,
    preservesTransparency: false,
    preservesAnimation: false,
    maxTestedSizeBytes: 50 * 1024 * 1024,
    knownLimitations: [
      'JPEG lacks an alpha channel; transparent pixels are filled with solid white (#ffffff).',
      'Discrete Cosine Transform (DCT) lossy compression is applied, discarding high-frequency chrominance data.',
    ],
    verificationStatus: 'VERIFIED_LOCAL',
    lossinessExplanation:
      'Lossy transformation. Color sub-sampling and quantization discard visual data. Alpha channel transparency is permanently flattened.',
  },
  {
    id: 'jpg-to-webp',
    name: 'JPEG to WebP',
    description: 'Converts JPEG to modern WebP format with improved compression efficiency.',
    category: 'image',
    inputMime: 'image/jpeg',
    outputMime: 'image/webp',
    inputExtension: 'jpg',
    outputExtension: 'webp',
    engine: 'Canvas 2D / Web Worker',
    isBrowserLocal: true,
    preservesLossless: false,
    preservesTransparency: false,
    preservesAnimation: false,
    maxTestedSizeBytes: 50 * 1024 * 1024,
    knownLimitations: [
      'Re-encoding a lossy image into another lossy codec can introduce compound quantization noise if quality is set too low.',
    ],
    verificationStatus: 'VERIFIED_LOCAL',
    lossinessExplanation:
      'WebP utilizes intra-frame predictive coding offering superior compression ratio compared to legacy JPEG.',
  },
  {
    id: 'webp-to-jpg',
    name: 'WebP to JPEG',
    description: 'Converts WebP to widely compatible JPEG format with white background fill.',
    category: 'image',
    inputMime: 'image/webp',
    outputMime: 'image/jpeg',
    inputExtension: 'webp',
    outputExtension: 'jpg',
    engine: 'Canvas 2D / Web Worker',
    isBrowserLocal: true,
    preservesLossless: false,
    preservesTransparency: false,
    preservesAnimation: false,
    maxTestedSizeBytes: 50 * 1024 * 1024,
    knownLimitations: [
      'Alpha transparency present in source WebP is flattened to solid white.',
      'Animated WebP will only render the first frame.',
    ],
    verificationStatus: 'VERIFIED_LOCAL',
    lossinessExplanation:
      'Lossy transformation. Ideal for compatibility with older portals and workflows that do not accept WebP.',
  },
  {
    id: 'png-to-webp',
    name: 'PNG to WebP',
    description: 'Converts PNG to WebP, preserving transparency while significantly reducing file size.',
    category: 'image',
    inputMime: 'image/png',
    outputMime: 'image/webp',
    inputExtension: 'png',
    outputExtension: 'webp',
    engine: 'Canvas 2D / Web Worker',
    isBrowserLocal: true,
    preservesLossless: true,
    preservesTransparency: true,
    preservesAnimation: false,
    maxTestedSizeBytes: 50 * 1024 * 1024,
    knownLimitations: [
      'Browser WebP encoder applies quality compression setting; quality 1.0 preserves maximum fidelity.',
    ],
    verificationStatus: 'VERIFIED_LOCAL',
    lossinessExplanation:
      'Preserves full alpha transparency with 25-35% lower byte size than standard PNG.',
  },
  {
    id: 'webp-to-png',
    name: 'WebP to PNG',
    description: 'Converts WebP to lossless PNG format, preserving alpha transparency.',
    category: 'image',
    inputMime: 'image/webp',
    outputMime: 'image/png',
    inputExtension: 'webp',
    outputExtension: 'png',
    engine: 'Canvas 2D / Web Worker',
    isBrowserLocal: true,
    preservesLossless: true,
    preservesTransparency: true,
    preservesAnimation: false,
    maxTestedSizeBytes: 50 * 1024 * 1024,
    knownLimitations: [
      'Output file size is larger than source WebP.',
      'Only the first frame of animated WebP is rendered.',
    ],
    verificationStatus: 'VERIFIED_LOCAL',
    lossinessExplanation:
      'Decompresses WebP raster and encapsulates it into lossless deflate-compressed PNG blocks.',
  },

  // ==========================================
  // Image <-> PDF Conversions (Phase 2 - Verified Local)
  // ==========================================
  {
    id: 'jpg-to-pdf',
    name: 'JPEG to PDF',
    description: 'Wraps one or more JPEG images into standardized PDF document pages.',
    category: 'pdf',
    inputMime: 'image/jpeg',
    outputMime: 'application/pdf',
    inputExtension: 'jpg',
    outputExtension: 'pdf',
    engine: 'pdf-lib',
    isBrowserLocal: true,
    preservesLossless: false,
    preservesTransparency: false,
    preservesAnimation: false,
    maxTestedSizeBytes: 50 * 1024 * 1024,
    knownLimitations: [
      'Text inside the photograph is rasterized, not selectable or searchable vector text.',
      'Page dimensions conform to chosen standard (A4, Letter, or image bounds).',
    ],
    verificationStatus: 'VERIFIED_LOCAL',
    lossinessExplanation:
      'JPEG stream is directly embedded into PDF DCTDecode XObject without generational re-compression.',
  },
  {
    id: 'png-to-pdf',
    name: 'PNG to PDF',
    description: 'Embeds PNG images into PDF document pages with lossless raster preservation.',
    category: 'pdf',
    inputMime: 'image/png',
    outputMime: 'application/pdf',
    inputExtension: 'png',
    outputExtension: 'pdf',
    engine: 'pdf-lib',
    isBrowserLocal: true,
    preservesLossless: true,
    preservesTransparency: true,
    preservesAnimation: false,
    maxTestedSizeBytes: 50 * 1024 * 1024,
    knownLimitations: [
      'Text within PNG is not selectable or OCR searchable without dedicated OCR.',
    ],
    verificationStatus: 'VERIFIED_LOCAL',
    lossinessExplanation:
      'PNG raster and alpha mask embedded via FlateDecode lossless PDF object streams.',
  },
  {
    id: 'webp-to-pdf',
    name: 'WebP to PDF',
    description: 'Converts WebP images into standardized PDF document pages.',
    category: 'pdf',
    inputMime: 'image/webp',
    outputMime: 'application/pdf',
    inputExtension: 'webp',
    outputExtension: 'pdf',
    engine: 'Canvas 2D + pdf-lib',
    isBrowserLocal: true,
    preservesLossless: false,
    preservesTransparency: true,
    preservesAnimation: false,
    maxTestedSizeBytes: 50 * 1024 * 1024,
    knownLimitations: [
      'WebP is rasterized through browser canvas for embedding into PDF object streams.',
    ],
    verificationStatus: 'VERIFIED_LOCAL',
    lossinessExplanation:
      'Browser decodes WebP raster and transfers pixel buffers into PDF pages with exact aspect ratio preservation.',
  },
  {
    id: 'pdf-to-jpg',
    name: 'PDF to JPEG',
    description: 'Renders PDF document pages into high-resolution JPEG images.',
    category: 'image',
    inputMime: 'application/pdf',
    outputMime: 'image/jpeg',
    inputExtension: 'pdf',
    outputExtension: 'jpg',
    engine: 'pdfjs-dist + Canvas 2D',
    isBrowserLocal: true,
    preservesLossless: false,
    preservesTransparency: false,
    preservesAnimation: false,
    maxTestedSizeBytes: 50 * 1024 * 1024,
    knownLimitations: [
      'Vector fonts and line art are rasterized to pixels at chosen resolution (1x standard or 2x high-DPI).',
      'Multi-page PDFs generate individual image files or a bundled ZIP archive.',
    ],
    verificationStatus: 'VERIFIED_LOCAL',
    lossinessExplanation:
      'Continuous vector shapes and TrueType/Type1 fonts are rasterized to pixel grid and encoded using lossy JPEG DCT.',
  },
  {
    id: 'pdf-to-png',
    name: 'PDF to PNG',
    description: 'Renders PDF document pages into crisp, lossless PNG images.',
    category: 'image',
    inputMime: 'application/pdf',
    outputMime: 'image/png',
    inputExtension: 'pdf',
    outputExtension: 'png',
    engine: 'pdfjs-dist + Canvas 2D',
    isBrowserLocal: true,
    preservesLossless: true,
    preservesTransparency: false,
    preservesAnimation: false,
    maxTestedSizeBytes: 50 * 1024 * 1024,
    knownLimitations: [
      'Vector elements rasterized to pixels. File size is significantly larger than JPEG output.',
    ],
    verificationStatus: 'VERIFIED_LOCAL',
    lossinessExplanation:
      'Rasterizes PDF page at 1x or 2x viewport scale and encodes with lossless deflate compression.',
  },

  // ==========================================
  // Document Conversions (Phase 3 - Researched / Planned)
  // ==========================================
  {
    id: 'docx-to-pdf',
    name: 'DOCX to PDF',
    description: 'Converts Word document to PDF format.',
    category: 'document',
    inputMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    outputMime: 'application/pdf',
    inputExtension: 'docx',
    outputExtension: 'pdf',
    engine: 'docx-preview + pdf-lib (Planned) / LibreOffice WASM (Evaluation)',
    isBrowserLocal: true,
    preservesLossless: false,
    preservesTransparency: false,
    preservesAnimation: false,
    maxTestedSizeBytes: 0,
    knownLimitations: [
      'Browser-local DOCX layout engines (docx-preview/mammoth) do not fully replicate MS Word typography, hyphenation, or pagination rules.',
      'LibreOffice WASM requires 30MB-80MB WebAssembly binaries and SharedArrayBuffer.',
    ],
    verificationStatus: 'PLANNED',
    lossinessExplanation: 'Planned Phase 3 capability. Subject to font availability and layout engine fidelity.',
  },
  {
    id: 'xlsx-to-csv',
    name: 'XLSX to CSV',
    description: 'Extracts spreadsheet tables to comma-separated values.',
    category: 'document',
    inputMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    outputMime: 'text/csv',
    inputExtension: 'xlsx',
    outputExtension: 'csv',
    engine: 'SheetJS / Pure JS XML Parser (Planned)',
    isBrowserLocal: true,
    preservesLossless: false,
    preservesTransparency: false,
    preservesAnimation: false,
    maxTestedSizeBytes: 0,
    knownLimitations: [
      'Discards charts, formulas, macro code, cell coloring, and multi-sheet workbooks (extracts active sheet only).',
    ],
    verificationStatus: 'PLANNED',
    lossinessExplanation: 'Extracts tabular cell values without formatting or formulas.',
  },

  // ==========================================
  // Media Conversions (Phase 4 - Researched / Planned)
  // ==========================================
  {
    id: 'mov-to-mp4',
    name: 'MOV to MP4',
    description: 'Remuxes or transcodes QuickTime video to universal MP4 container.',
    category: 'media',
    inputMime: 'video/quicktime',
    outputMime: 'video/mp4',
    inputExtension: 'mov',
    outputExtension: 'mp4',
    engine: 'ffmpeg.wasm (Evaluation) / WebCodecs API (Planned)',
    isBrowserLocal: true,
    preservesLossless: false,
    preservesTransparency: false,
    preservesAnimation: false,
    maxTestedSizeBytes: 0,
    knownLimitations: [
      'ffmpeg.wasm requires 25MB-35MB WASM core download and SharedArrayBuffer (COOP/COEP HTTP headers).',
      'High CPU utilization and memory limits on mobile browsers.',
    ],
    verificationStatus: 'PLANNED',
    lossinessExplanation: 'Planned Phase 4 capability. Video re-encoding or container remuxing.',
  },
  {
    id: 'mp4-to-mp3',
    name: 'MP4 to MP3',
    description: 'Extracts audio track from MP4 video container.',
    category: 'media',
    inputMime: 'video/mp4',
    outputMime: 'audio/mpeg',
    inputExtension: 'mp4',
    outputExtension: 'mp3',
    engine: 'ffmpeg.wasm / Web Audio API (Planned)',
    isBrowserLocal: true,
    preservesLossless: false,
    preservesTransparency: false,
    preservesAnimation: false,
    maxTestedSizeBytes: 0,
    knownLimitations: [
      'Requires audio codec extraction and MP3 LAME encoder execution in Web Worker.',
    ],
    verificationStatus: 'PLANNED',
    lossinessExplanation: 'Extracts and encodes audio stream to MPEG-1 Audio Layer III.',
  },
];

/**
 * Returns all verified, locally runnable conversions.
 */
export function getVerifiedConversions(): ConversionDefinition[] {
  return CONVERSION_CAPABILITY_REGISTRY.filter(
    (c) => c.verificationStatus === 'VERIFIED_LOCAL' && c.isBrowserLocal === true
  );
}

/**
 * Look up conversion definition by id.
 */
export function getConversionById(id: string): ConversionDefinition | undefined {
  return CONVERSION_CAPABILITY_REGISTRY.find((c) => c.id === id);
}

/**
 * Returns all verified conversions available for a given input MIME type.
 */
export function getSupportedConversionsForMime(inputMime: string): ConversionDefinition[] {
  const normalized = inputMime.toLowerCase().trim();
  return getVerifiedConversions().filter(
    (c) => c.inputMime.toLowerCase() === normalized
  );
}

/**
 * Check if a conversion from inputMime to outputMime is verified and supported locally.
 */
export function isConversionSupported(inputMime: string, outputMime: string): boolean {
  const normIn = inputMime.toLowerCase().trim();
  const normOut = outputMime.toLowerCase().trim();
  return getVerifiedConversions().some(
    (c) => c.inputMime.toLowerCase() === normIn && c.outputMime.toLowerCase() === normOut
  );
}

/**
 * Returns the target conversion definition for a specific input and output MIME pair.
 */
export function findConversion(inputMime: string, outputMime: string): ConversionDefinition | undefined {
  const normIn = inputMime.toLowerCase().trim();
  const normOut = outputMime.toLowerCase().trim();
  return getVerifiedConversions().find(
    (c) => c.inputMime.toLowerCase() === normIn && c.outputMime.toLowerCase() === normOut
  );
}
