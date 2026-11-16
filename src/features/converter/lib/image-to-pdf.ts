import { PDFDocument } from 'pdf-lib';
import { detectFormatFromHeader } from '@/lib/file-validation/file-signatures';
import { ImageToPdfOptions } from '../types';

export class ImageToPdfError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ImageToPdfError';
  }
}

export interface ImageInputItem {
  blob: Blob;
  name: string;
}

export interface ImageToPdfResult {
  blob: Blob;
  url: string;
  filename: string;
  sizeBytes: number;
  pageCount: number;
  processingTimeMs: number;
  warnings: string[];
}

// Standard Page Dimensions in PostScript Points (72 points per inch)
const PAGE_DIMENSIONS = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612.0, height: 792.0 },
};

const MARGIN_POINTS = {
  none: 0,
  small: 18, // 0.25 in
  normal: 36, // 0.5 in
};

/**
 * Converts one or more images into a single structured PDF document.
 * Preserves aspect ratio, supports standard page sizes (A4, Letter, Fit),
 * configurable margins, and verified page ordering.
 */
export async function convertImagesToPdf(
  images: ImageInputItem[],
  options: ImageToPdfOptions,
  outputFilename: string = 'converted-images.pdf'
): Promise<ImageToPdfResult> {
  const startTime = performance.now();

  if (images.length === 0) {
    throw new ImageToPdfError('At least one image is required to generate a PDF.', 'NO_IMAGES_PROVIDED');
  }

  const pdfDoc = await PDFDocument.create();
  if (options.title) {
    pdfDoc.setTitle(options.title);
  }
  pdfDoc.setCreator('FileFix Local Converter');
  pdfDoc.setProducer('pdf-lib (Browser-Local)');

  const warnings: string[] = [];

  for (let idx = 0; idx < images.length; idx++) {
    const item = images[idx];
    const buffer = await item.blob.arrayBuffer();
    const detected = detectFormatFromHeader(buffer);

    if (!detected || !detected.mime.startsWith('image/')) {
      throw new ImageToPdfError(
        `File "${item.name}" has an invalid image header and cannot be converted to PDF.`,
        'INVALID_IMAGE_HEADER'
      );
    }

    let embeddedImage;
    let imgWidth = 0;
    let imgHeight = 0;

    if (detected.mime === 'image/jpeg') {
      try {
        embeddedImage = await pdfDoc.embedJpg(buffer);
        imgWidth = embeddedImage.width;
        imgHeight = embeddedImage.height;
      } catch (err) {
        throw new ImageToPdfError(`Failed to embed JPEG "${item.name}": ${err instanceof Error ? err.message : 'Corrupt JPEG'}`, 'EMBED_JPEG_FAILED');
      }
    } else if (detected.mime === 'image/png') {
      try {
        embeddedImage = await pdfDoc.embedPng(buffer);
        imgWidth = embeddedImage.width;
        imgHeight = embeddedImage.height;
      } catch (err) {
        throw new ImageToPdfError(`Failed to embed PNG "${item.name}": ${err instanceof Error ? err.message : 'Corrupt PNG'}`, 'EMBED_PNG_FAILED');
      }
    } else {
      // WebP or other format: decode and convert to PNG buffer first
      warnings.push(`Image "${item.name}" (${detected.extension.toUpperCase()}) was rasterized to PNG for PDF embedding.`);
      const pngBuffer = await rasterizeToPngBuffer(item.blob);
      embeddedImage = await pdfDoc.embedPng(pngBuffer);
      imgWidth = embeddedImage.width;
      imgHeight = embeddedImage.height;
    }

    if (imgWidth <= 0 || imgHeight <= 0) {
      throw new ImageToPdfError(`Image "${item.name}" has invalid dimensions (${imgWidth}x${imgHeight}).`, 'INVALID_DIMENSIONS');
    }

    // Determine Page Width and Height
    const margin = MARGIN_POINTS[options.margin] ?? 0;
    let pageWidth: number;
    let pageHeight: number;

    if (options.pageSize === 'fit-image') {
      pageWidth = imgWidth + margin * 2;
      pageHeight = imgHeight + margin * 2;
    } else {
      const baseDim = PAGE_DIMENSIONS[options.pageSize] ?? PAGE_DIMENSIONS.a4;
      const isLandscapeImage = imgWidth > imgHeight;

      let useLandscape = false;
      if (options.orientation === 'landscape') {
        useLandscape = true;
      } else if (options.orientation === 'portrait') {
        useLandscape = false;
      } else {
        // 'auto' matches the image aspect ratio
        useLandscape = isLandscapeImage;
      }

      pageWidth = useLandscape ? Math.max(baseDim.width, baseDim.height) : Math.min(baseDim.width, baseDim.height);
      pageHeight = useLandscape ? Math.min(baseDim.width, baseDim.height) : Math.max(baseDim.width, baseDim.height);
    }

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Calculate fitted dimensions preserving aspect ratio
    const printableWidth = Math.max(1, pageWidth - margin * 2);
    const printableHeight = Math.max(1, pageHeight - margin * 2);

    const scaleFactor = Math.min(printableWidth / imgWidth, printableHeight / imgHeight);
    const drawWidth = imgWidth * scaleFactor;
    const drawHeight = imgHeight * scaleFactor;

    // Center image on the page (PDF origin is bottom-left)
    const drawX = margin + (printableWidth - drawWidth) / 2;
    const drawY = margin + (printableHeight - drawHeight) / 2;

    page.drawImage(embeddedImage, {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const pdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(pdfBlob);
  const processingTimeMs = Math.round(performance.now() - startTime);

  return {
    blob: pdfBlob,
    url,
    filename: outputFilename,
    sizeBytes: pdfBlob.size,
    pageCount: images.length,
    processingTimeMs,
    warnings,
  };
}

/**
 * Helper to transcode non-JPEG/PNG images (e.g. WebP) into PNG buffer for pdf-lib embedding.
 */
async function rasterizeToPngBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined') {
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not acquire 2D context for image transcoding.');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
    return await pngBlob.arrayBuffer();
  }

  if (typeof document !== 'undefined') {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const i = new Image();
      i.onload = () => {
        URL.revokeObjectURL(url);
        resolve(i);
      };
      i.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for PDF rasterization.'));
      };
      i.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not acquire 2D context for image transcoding.');
    ctx.drawImage(img, 0, 0);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas PNG export failed.'))), 'image/png');
    });
    return await pngBlob.arrayBuffer();
  }

  throw new Error('Canvas environment required for image rasterization.');
}
