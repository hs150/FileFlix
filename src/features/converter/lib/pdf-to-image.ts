import { detectFormatFromHeader } from '@/lib/file-validation/file-signatures';
import { createZipBlob } from '@/lib/zip/zip-writer';
import { ConvertedPageResult, PdfToImageOptions } from '../types';

export class PdfToImageError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'PdfToImageError';
  }
}

export interface PdfToImageResult {
  pages: ConvertedPageResult[];
  zipBlob?: Blob;
  zipUrl?: string;
  totalPageCount: number;
  selectedPageCount: number;
  format: 'image/jpeg' | 'image/png';
  processingTimeMs: number;
  warnings: string[];
}

/**
 * Renders PDF document pages into high-resolution JPEG or PNG images.
 * Runs 100% locally in browser memory or test runtime.
 */
export async function convertPdfToImages(
  pdfBuffer: ArrayBuffer,
  options: PdfToImageOptions,
  baseFilename: string = 'document.pdf',
  onProgress?: (current: number, total: number) => void
): Promise<PdfToImageResult> {
  const startTime = performance.now();
  const { targetFormat, scale = 2, quality = 0.92, pages: requestedPages } = options;

  // 1. Verify PDF header
  const detected = detectFormatFromHeader(pdfBuffer);
  if (!detected || detected.mime !== 'application/pdf') {
    throw new PdfToImageError(
      'Invalid file format. The file header does not match a valid PDF document.',
      'INVALID_PDF_HEADER'
    );
  }

  // 2. Load pdfjs-dist
  let pdfjs: any;
  if (typeof window === 'undefined') {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } else {
    pdfjs = await import('pdfjs-dist');
  }

  const data = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  if (totalPages === 0) {
    throw new PdfToImageError('The PDF document contains no pages.', 'EMPTY_PDF');
  }

  // Determine pages to convert (1-based index)
  let pagesToProcess: number[] = [];
  if (requestedPages && requestedPages.length > 0) {
    pagesToProcess = requestedPages.filter((p) => p >= 1 && p <= totalPages);
  } else {
    for (let p = 1; p <= totalPages; p++) {
      pagesToProcess.push(p);
    }
  }

  if (pagesToProcess.length === 0) {
    throw new PdfToImageError('No valid pages were selected for conversion.', 'NO_PAGES_SELECTED');
  }

  const extension = targetFormat === 'image/jpeg' ? 'jpg' : 'png';
  const nameWithoutExt = baseFilename.replace(/\.pdf$/i, '');
  const convertedPages: ConvertedPageResult[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < pagesToProcess.length; i++) {
    const pageNum = pagesToProcess[i];
    onProgress?.(i + 1, pagesToProcess.length);

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const width = Math.round(viewport.width);
    const height = Math.round(viewport.height);

    let canvas: HTMLCanvasElement | OffscreenCanvas;
    let ctx: any;

    if (typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext('2d', { willReadFrequently: false });
    } else if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(width, height);
      ctx = canvas.getContext('2d');
    } else {
      throw new PdfToImageError('No Canvas rendering context available in current environment.', 'NO_CANVAS');
    }

    if (!ctx) {
      throw new PdfToImageError(`Failed to acquire 2D rendering context for page ${pageNum}.`, 'CANVAS_CONTEXT_FAILED');
    }

    // For JPEG, fill with solid white background to prevent black or transparent artifacts
    if (targetFormat === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    // Render PDF page to canvas context
    const renderContext = {
      canvasContext: ctx,
      viewport,
    };

    await page.render(renderContext).promise;

    // Convert canvas to Blob
    let pageBlob: Blob;
    if ('toBlob' in canvas) {
      pageBlob = await new Promise<Blob>((resolve, reject) => {
        (canvas as HTMLCanvasElement).toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error(`Failed to encode page ${pageNum} to ${targetFormat}.`));
          },
          targetFormat,
          targetFormat === 'image/png' ? undefined : quality
        );
      });
      // Free canvas DOM memory
      (canvas as HTMLCanvasElement).width = 0;
      (canvas as HTMLCanvasElement).height = 0;
    } else {
      pageBlob = await (canvas as OffscreenCanvas).convertToBlob({
        type: targetFormat,
        quality: targetFormat === 'image/png' ? undefined : quality,
      });
    }

    const pageFilename = `${nameWithoutExt}-page-${pageNum}.${extension}`;
    const pageUrl = URL.createObjectURL(pageBlob);

    convertedPages.push({
      pageNumber: pageNum,
      blob: pageBlob,
      url: pageUrl,
      filename: pageFilename,
      width,
      height,
      sizeBytes: pageBlob.size,
    });
  }

  // If more than 1 page was rendered, bundle all pages into a ZIP archive
  let zipBlob: Blob | undefined;
  let zipUrl: string | undefined;

  if (convertedPages.length > 1) {
    const zipFiles = await Promise.all(
      convertedPages.map(async (p) => ({
        name: p.filename,
        data: new Uint8Array(await p.blob.arrayBuffer()),
      }))
    );
    zipBlob = createZipBlob(zipFiles);
    zipUrl = URL.createObjectURL(zipBlob);
  }

  const processingTimeMs = Math.round(performance.now() - startTime);

  return {
    pages: convertedPages,
    zipBlob,
    zipUrl,
    totalPageCount: totalPages,
    selectedPageCount: convertedPages.length,
    format: targetFormat,
    processingTimeMs,
    warnings,
  };
}
