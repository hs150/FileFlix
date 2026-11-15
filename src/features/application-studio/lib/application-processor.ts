import {
  processImageLocally,
  loadImageElement,
  canvasToBlob,
} from '../../image-studio/lib/image-processor';
import { ProcessingResult } from '../../image-studio/types';
import {
  ApplicationPreset,
  ApplicationProcessingOptions,
  ComplianceReport,
} from '../types';
import { calculateCenterCrop, calculatePadFit } from './aspect-math';
import { validatePresetCompliance } from './presets';

export interface ApplicationResult extends ProcessingResult {
  preset: ApplicationPreset;
  compliance: ComplianceReport;
  fittingMode: 'center-crop' | 'pad-white';
}

/**
 * Reads intrinsic dimensions from an image Blob, respecting EXIF orientation.
 */
export async function getImageIntrinsicDimensions(
  blob: Blob
): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap !== 'undefined') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      const dims = { width: bmp.width, height: bmp.height };
      bmp.close();
      return dims;
    } catch {
      // Fallback to Image element
    }
  }

  const img = await loadImageElement(blob);
  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
  };
}

/**
 * Creates an intermediate padded canvas Blob (letterbox/pillarbox with solid white background).
 */
async function createPaddedCanvasBlob(
  sourceBlob: Blob,
  targetWidth: number,
  targetHeight: number
): Promise<Blob> {
  const img = await loadImageElement(sourceBlob);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  const { destX, destY, drawWidth, drawHeight } = calculatePadFit(
    srcW,
    srcH,
    targetWidth,
    targetHeight
  );

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) {
    throw new Error('Failed to create 2D rendering context for padding.');
  }

  // Paint solid white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw scaled image centered
  ctx.drawImage(img, destX, destY, drawWidth, drawHeight);

  return canvasToBlob(canvas, 'image/png', 1.0);
}

/**
 * Processes an image to meet an official application preset's constraints.
 */
export async function processApplicationImage(
  options: ApplicationProcessingOptions
): Promise<ApplicationResult> {
  const {
    sourceBlob,
    preset,
    fittingMode,
    customWidth,
    customHeight,
    targetSizeKb,
    allowDimensionReductionForTarget = false,
    onProgress,
    signal,
  } = options;

  onProgress?.('Inspecting original image dimensions...');
  const { width: srcWidth, height: srcHeight } = await getImageIntrinsicDimensions(sourceBlob);

  const targetWidth = customWidth || preset.exactWidth || preset.minWidth;
  const targetHeight = customHeight || preset.exactHeight || preset.minHeight;
  const effectiveTargetKb = targetSizeKb || preset.defaultTargetKb;

  let baseResult: ProcessingResult;

  if (fittingMode === 'pad-white') {
    onProgress?.(`Padding image onto ${targetWidth}×${targetHeight} white canvas...`);
    const paddedBlob = await createPaddedCanvasBlob(sourceBlob, targetWidth, targetHeight);

    onProgress?.('Compressing padded image to official specification...');
    baseResult = await processImageLocally({
      sourceBlob: paddedBlob,
      crop: { enabled: false, x: 0, y: 0, width: targetWidth, height: targetHeight },
      resize: {
        enabled: true,
        width: targetWidth,
        height: targetHeight,
        maintainAspectRatio: true,
      },
      compression: {
        format: preset.recommendedFormat,
        quality: 0.85,
        targetSizeKb: effectiveTargetKb || null,
        allowDimensionReductionForTarget,
      },
      onProgress,
      signal,
    });
  } else {
    // Center Crop
    onProgress?.(`Calculating center crop for ${targetWidth}×${targetHeight}...`);
    const cropBox = calculateCenterCrop(srcWidth, srcHeight, targetWidth, targetHeight);

    onProgress?.('Rendering cropped image and optimizing file size...');
    baseResult = await processImageLocally({
      sourceBlob,
      crop: { enabled: true, ...cropBox },
      resize: {
        enabled: true,
        width: targetWidth,
        height: targetHeight,
        maintainAspectRatio: false,
      },
      compression: {
        format: preset.recommendedFormat,
        quality: 0.85,
        targetSizeKb: effectiveTargetKb || null,
        allowDimensionReductionForTarget,
      },
      onProgress,
      signal,
    });
  }

  // Validate technical compliance of the generated result
  const compliance = validatePresetCompliance(
    {
      width: baseResult.width,
      height: baseResult.height,
      sizeBytes: baseResult.sizeBytes,
      format: baseResult.format,
    },
    preset,
    customWidth && customHeight ? { width: customWidth, height: customHeight } : undefined
  );

  return {
    ...baseResult,
    preset,
    compliance,
    fittingMode,
  };
}
