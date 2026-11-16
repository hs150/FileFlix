import { detectFormatFromHeader } from '@/lib/file-validation/file-signatures';
import { ImageConversionOptions } from '../types';

export class ImageConversionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ImageConversionError';
  }
}

export interface ImageConversionResult {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
  format: 'image/jpeg' | 'image/png' | 'image/webp';
  processingTimeMs: number;
  warnings: string[];
}

/**
 * Validates output blob magic bytes to ensure the browser didn't silently fall back
 * to a different format (e.g., falling back to image/png when WebP is unsupported).
 */
export async function verifyEncodedFormatMagicBytes(
  blob: Blob,
  expectedFormat: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<void> {
  const buffer = await blob.slice(0, 16).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (expectedFormat === 'image/jpeg') {
    if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      throw new ImageConversionError(
        'Browser canvas encoder produced invalid JPEG header bytes.',
        'INVALID_JPEG_ENCODING'
      );
    }
  } else if (expectedFormat === 'image/png') {
    if (
      bytes.length < 8 ||
      bytes[0] !== 0x89 ||
      bytes[1] !== 0x50 ||
      bytes[2] !== 0x4e ||
      bytes[3] !== 0x47
    ) {
      throw new ImageConversionError(
        'Browser canvas encoder produced invalid PNG header bytes.',
        'INVALID_PNG_ENCODING'
      );
    }
  } else if (expectedFormat === 'image/webp') {
    if (
      bytes.length < 12 ||
      bytes[0] !== 0x52 ||
      bytes[1] !== 0x49 ||
      bytes[2] !== 0x46 ||
      bytes[3] !== 0x46 ||
      bytes[8] !== 0x57 ||
      bytes[9] !== 0x45 ||
      bytes[10] !== 0x42 ||
      bytes[11] !== 0x50
    ) {
      throw new ImageConversionError(
        'Browser canvas encoder produced invalid WebP header bytes.',
        'INVALID_WEBP_ENCODING'
      );
    }
  }
}

/**
 * Converts an image locally inside browser memory using Canvas 2D / OffscreenCanvas.
 * Ensures strict magic-byte validation, proper alpha flattening, and format integrity.
 */
export async function convertImageLocally(
  sourceBlob: Blob,
  options: ImageConversionOptions
): Promise<ImageConversionResult> {
  const startTime = performance.now();
  const { targetFormat, quality = 0.92, backgroundColor = '#ffffff' } = options;

  // 1. Verify Source Magic Bytes
  const sourceHeaderBuffer = await sourceBlob.slice(0, 32).arrayBuffer();
  const detected = detectFormatFromHeader(sourceHeaderBuffer);

  if (!detected || !detected.mime.startsWith('image/')) {
    throw new ImageConversionError(
      'Invalid file content. The source file header does not match a supported image format.',
      'INVALID_SOURCE_IMAGE'
    );
  }

  const warnings: string[] = [];

  // Warn about transparency flattening when converting to JPEG
  if (targetFormat === 'image/jpeg' && (detected.mime === 'image/png' || detected.mime === 'image/webp')) {
    warnings.push(
      'JPEG does not support alpha transparency. Transparent pixels were filled with solid white.'
    );
  }

  // Educational note when converting JPEG to PNG
  if (detected.mime === 'image/jpeg' && targetFormat === 'image/png') {
    warnings.push(
      'Converting lossy JPEG to PNG stops further generational compression loss, but cannot reconstruct original high-frequency details lost during initial JPEG encoding.'
    );
  }

  let finalBlob: Blob;
  let finalWidth = 0;
  let finalHeight = 0;

  // Use OffscreenCanvas / Worker if available
  const hasOffscreen = typeof OffscreenCanvas !== 'undefined';
  const hasCreateImageBitmap = typeof createImageBitmap !== 'undefined';

  if (hasOffscreen && hasCreateImageBitmap) {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(sourceBlob, { imageOrientation: 'from-image' });
      finalWidth = bitmap.width;
      finalHeight = bitmap.height;

      const canvas = new OffscreenCanvas(finalWidth, finalHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new ImageConversionError('Failed to initialize 2D context on OffscreenCanvas.', 'CANVAS_INIT_ERROR');
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (targetFormat === 'image/jpeg') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, finalWidth, finalHeight);
      } else {
        ctx.clearRect(0, 0, finalWidth, finalHeight);
      }

      ctx.drawImage(bitmap, 0, 0);

      // Convert to target Blob
      finalBlob = await canvas.convertToBlob({
        type: targetFormat,
        quality: targetFormat === 'image/png' ? undefined : quality,
      });
    } finally {
      if (bitmap) {
        bitmap.close();
      }
    }
  } else if (typeof document !== 'undefined') {
    // DOM Canvas Fallback (Main Thread)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(sourceBlob);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new ImageConversionError('Failed to decode source image into browser DOM.', 'IMAGE_DECODE_ERROR'));
      };
      image.src = url;
    });

    finalWidth = img.naturalWidth || img.width;
    finalHeight = img.naturalHeight || img.height;

    const canvas = document.createElement('canvas');
    canvas.width = finalWidth;
    canvas.height = finalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new ImageConversionError('Failed to initialize 2D context on DOM Canvas.', 'CANVAS_INIT_ERROR');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (targetFormat === 'image/jpeg') {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, finalWidth, finalHeight);
    } else {
      ctx.clearRect(0, 0, finalWidth, finalHeight);
    }

    ctx.drawImage(img, 0, 0);

    finalBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new ImageConversionError(`Failed to encode canvas to ${targetFormat}.`, 'ENCODE_FAILED'));
        },
        targetFormat,
        targetFormat === 'image/png' ? undefined : quality
      );
    });

    canvas.width = 0;
    canvas.height = 0;
  } else {
    throw new ImageConversionError(
      'Image rendering requires an active browser runtime with Canvas or OffscreenCanvas support.',
      'NO_CANVAS_RUNTIME'
    );
  }

  // 2. Strict Blob verification: detect browser silent fallback
  if (finalBlob.type && finalBlob.type !== targetFormat) {
    throw new ImageConversionError(
      `Browser encoder fell back to ${finalBlob.type} instead of requested ${targetFormat}.`,
      'BROWSER_FORMAT_FALLBACK'
    );
  }

  // 3. Verify magic bytes of the output Blob
  await verifyEncodedFormatMagicBytes(finalBlob, targetFormat);

  const processingTimeMs = Math.round(performance.now() - startTime);
  const url = URL.createObjectURL(finalBlob);

  return {
    blob: finalBlob,
    url,
    width: finalWidth,
    height: finalHeight,
    sizeBytes: finalBlob.size,
    format: targetFormat,
    processingTimeMs,
    warnings,
  };
}
