/**
 * Mathematical calculations for aspect-ratio fitting:
 * 1. Center-crop: crops edges to match target aspect ratio exactly.
 * 2. Pad-fit (letterbox/pillarbox): scales image to fit inside target box and centers it with margins.
 */

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PadFitResult {
  destX: number;
  destY: number;
  drawWidth: number;
  drawHeight: number;
  targetWidth: number;
  targetHeight: number;
}

/**
 * Calculates a center-crop bounding box on the source image to match target aspect ratio.
 */
export function calculateCenterCrop(
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
  targetHeight: number
): CropBox {
  if (srcWidth <= 0 || srcHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return { x: 0, y: 0, width: Math.max(1, srcWidth), height: Math.max(1, srcHeight) };
  }

  const srcRatio = srcWidth / srcHeight;
  const targetRatio = targetWidth / targetHeight;

  let cropW = srcWidth;
  let cropH = srcHeight;
  let x = 0;
  let y = 0;

  if (srcRatio > targetRatio) {
    // Source is wider than target: crop left & right
    cropH = srcHeight;
    cropW = Math.max(1, Math.round(srcHeight * targetRatio));
    x = Math.max(0, Math.round((srcWidth - cropW) / 2));
    y = 0;
  } else if (srcRatio < targetRatio) {
    // Source is taller than target: crop top & bottom
    cropW = srcWidth;
    cropH = Math.max(1, Math.round(srcWidth / targetRatio));
    x = 0;
    y = Math.max(0, Math.round((srcHeight - cropH) / 2));
  } else {
    // Ratios match exactly
    cropW = srcWidth;
    cropH = srcHeight;
    x = 0;
    y = 0;
  }

  // Boundary protections
  cropW = Math.min(cropW, srcWidth - x);
  cropH = Math.min(cropH, srcHeight - y);

  return { x, y, width: cropW, height: cropH };
}

/**
 * Calculates scaled dimensions and offsets to fit an image entirely inside target dimensions without cropping.
 */
export function calculatePadFit(
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
  targetHeight: number
): PadFitResult {
  if (srcWidth <= 0 || srcHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return {
      destX: 0,
      destY: 0,
      drawWidth: Math.max(1, targetWidth),
      drawHeight: Math.max(1, targetHeight),
      targetWidth,
      targetHeight,
    };
  }

  const scale = Math.min(targetWidth / srcWidth, targetHeight / srcHeight);
  const drawWidth = Math.max(1, Math.round(srcWidth * scale));
  const drawHeight = Math.max(1, Math.round(srcHeight * scale));

  const destX = Math.max(0, Math.round((targetWidth - drawWidth) / 2));
  const destY = Math.max(0, Math.round((targetHeight - drawHeight) / 2));

  return {
    destX,
    destY,
    drawWidth,
    drawHeight,
    targetWidth,
    targetHeight,
  };
}
