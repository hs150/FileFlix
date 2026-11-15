import {
  CropSettings,
  ResizeSettings,
  CompressionSettings,
  ProcessingResult,
  SupportedOutputFormat,
} from '../types';
import { clampCropBox } from './image-math';

/**
 * Encodes a canvas to a Blob with timeout protection
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: SupportedOutputFormat,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error(`Failed to encode image to ${format}`));
          }
        },
        format,
        quality
      );
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Loads an image from Blob or File, respecting EXIF orientation where supported.
 */
export async function loadImageElement(source: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image data into browser image element.'));
    };
    img.src = url;
  });
}

export interface ProcessImageOptions {
  sourceBlob: Blob;
  resize: ResizeSettings;
  crop: CropSettings;
  compression: CompressionSettings;
  onProgress?: (message: string) => void;
}

/**
 * Processes an image completely inside the browser using HTML5 Canvas.
 * Zero network requests are made.
 */
export async function processImageLocally(
  options: ProcessImageOptions
): Promise<ProcessingResult> {
  const startTime = performance.now();
  const { sourceBlob, resize, crop, compression, onProgress } = options;

  onProgress?.('Decoding image in browser memory...');
  const img = await loadImageElement(sourceBlob);

  const origWidth = img.naturalWidth || img.width;
  const origHeight = img.naturalHeight || img.height;

  if (origWidth === 0 || origHeight === 0) {
    throw new Error('Image has zero dimensions.');
  }

  // 1. Determine Crop Region
  let cropX = 0;
  let cropY = 0;
  let cropW = origWidth;
  let cropH = origHeight;

  if (crop.enabled) {
    const clamped = clampCropBox(crop, origWidth, origHeight);
    cropX = clamped.x;
    cropY = clamped.y;
    cropW = clamped.width;
    cropH = clamped.height;
  }

  // 2. Determine Output Dimensions
  let finalWidth = cropW;
  let finalHeight = cropH;

  if (resize.enabled) {
    if (resize.width > 0 && resize.height > 0) {
      finalWidth = Math.round(resize.width);
      finalHeight = Math.round(resize.height);
    } else if (resize.width > 0) {
      finalWidth = Math.round(resize.width);
      finalHeight = Math.round(finalWidth / (cropW / cropH));
    } else if (resize.height > 0) {
      finalHeight = Math.round(resize.height);
      finalWidth = Math.round(finalHeight * (cropW / cropH));
    }
  }

  // Ensure minimum 1x1 dimensions
  finalWidth = Math.max(1, finalWidth);
  finalHeight = Math.max(1, finalHeight);

  // 3. Render onto Canvas
  onProgress?.('Rendering transformations on canvas...');
  const canvas = document.createElement('canvas');
  canvas.width = finalWidth;
  canvas.height = finalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });

  if (!ctx) {
    throw new Error('Failed to acquire 2D rendering context for Canvas.');
  }

  // High quality interpolation
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Handle transparency for non-alpha formats like JPEG
  if (compression.format === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, finalWidth, finalHeight);
  } else {
    ctx.clearRect(0, 0, finalWidth, finalHeight);
  }

  // Draw transformed slice
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, finalWidth, finalHeight);

  // 4. Encode & Optimize
  let finalBlob: Blob;
  let targetAchieved: boolean | undefined = undefined;
  let explanation: string | undefined = undefined;

  if (compression.targetSizeKb && compression.targetSizeKb > 0) {
    onProgress?.(`Optimizing encoding for target size: ${compression.targetSizeKb} KB...`);
    const targetBytes = compression.targetSizeKb * 1024;

    if (compression.format === 'image/png') {
      // PNG is lossless in browser canvas; quality parameter is ignored
      finalBlob = await canvasToBlob(canvas, compression.format, 1.0);
      if (finalBlob.size > targetBytes) {
        targetAchieved = false;
        explanation = `PNG is a lossless format and could not be compressed to ${compression.targetSizeKb} KB without format conversion to WebP/JPEG or dimension downscaling.`;
      } else {
        targetAchieved = true;
      }
    } else {
      // Binary search over quality for JPEG / WebP
      let low = 0.05;
      let high = 0.98;
      let bestBlob = await canvasToBlob(canvas, compression.format, high);

      if (bestBlob.size <= targetBytes) {
        finalBlob = bestBlob;
        targetAchieved = true;
      } else {
        // Iterate up to 7 steps
        for (let step = 0; step < 7; step++) {
          const mid = (low + high) / 2;
          const candidateBlob = await canvasToBlob(canvas, compression.format, mid);

          if (candidateBlob.size <= targetBytes) {
            bestBlob = candidateBlob;
            low = mid; // Try higher quality
          } else {
            high = mid; // Needs lower quality
          }
        }

        if (bestBlob.size <= targetBytes) {
          finalBlob = bestBlob;
          targetAchieved = true;
        } else {
          // Still above target at lowest quality
          const lowestQualityBlob = await canvasToBlob(canvas, compression.format, low);
          if (lowestQualityBlob.size <= targetBytes) {
            finalBlob = lowestQualityBlob;
            targetAchieved = true;
          } else if (compression.allowDimensionReductionForTarget) {
            // Downscale dimensions iteratively
            onProgress?.('Downscaling dimensions to achieve target size...');
            let scaleCanvas = canvas;
            let currentBlob = lowestQualityBlob;
            let scaleFactor = Math.sqrt(targetBytes / currentBlob.size) * 0.95;

            while (scaleFactor < 0.95 && scaleFactor > 0.1 && currentBlob.size > targetBytes) {
              const scaledW = Math.max(1, Math.round(scaleCanvas.width * scaleFactor));
              const scaledH = Math.max(1, Math.round(scaleCanvas.height * scaleFactor));

              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = scaledW;
              tempCanvas.height = scaledH;
              const tempCtx = tempCanvas.getContext('2d');
              if (!tempCtx) break;

              if (compression.format === 'image/jpeg') {
                tempCtx.fillStyle = '#ffffff';
                tempCtx.fillRect(0, 0, scaledW, scaledH);
              }
              tempCtx.imageSmoothingEnabled = true;
              tempCtx.imageSmoothingQuality = 'high';
              tempCtx.drawImage(scaleCanvas, 0, 0, scaledW, scaledH);

              currentBlob = await canvasToBlob(tempCanvas, compression.format, 0.7);
              finalWidth = scaledW;
              finalHeight = scaledH;
              scaleCanvas = tempCanvas;
              scaleFactor *= 0.9;
            }

            finalBlob = currentBlob;
            targetAchieved = finalBlob.size <= targetBytes;
            explanation = targetAchieved
              ? `Achieved target size with automatic dimension reduction to ${finalWidth}x${finalHeight}px.`
              : `Reduced to ${finalWidth}x${finalHeight}px, resulting in ${(finalBlob.size / 1024).toFixed(1)} KB (target was ${compression.targetSizeKb} KB).`;
          } else {
            finalBlob = lowestQualityBlob;
            targetAchieved = false;
            explanation = `Target size ${compression.targetSizeKb} KB could not be reached at ${finalWidth}x${finalHeight}px without dimension downscaling (smallest achieved: ${(finalBlob.size / 1024).toFixed(1)} KB).`;
          }
        }
      }
    }
  } else {
    // Normal encoding at specified quality
    onProgress?.(`Encoding to ${compression.format} at ${Math.round(compression.quality * 100)}% quality...`);
    finalBlob = await canvasToBlob(canvas, compression.format, compression.quality);
  }

  // Cleanup canvas memory
  canvas.width = 0;
  canvas.height = 0;

  const url = URL.createObjectURL(finalBlob);
  const processingTimeMs = Math.round(performance.now() - startTime);

  return {
    blob: finalBlob,
    url,
    width: finalWidth,
    height: finalHeight,
    sizeBytes: finalBlob.size,
    format: compression.format,
    processingTimeMs,
    targetSizeAchieved: targetAchieved,
    targetSizeExplanation: explanation,
  };
}
