/**
 * Image calculation, aspect ratio, and sizing helpers
 */

export function calculateAspectRatio(width: number, height: number): number {
  if (height === 0) return 1;
  return width / height;
}

export function calculateHeightFromWidth(width: number, aspectRatio: number): number {
  return Math.max(1, Math.round(width / aspectRatio));
}

export function calculateWidthFromHeight(height: number, aspectRatio: number): number {
  return Math.max(1, Math.round(height * aspectRatio));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clampCropBox(
  crop: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number
): { x: number; y: number; width: number; height: number } {
  const x = clamp(crop.x, 0, imageWidth - 1);
  const y = clamp(crop.y, 0, imageHeight - 1);
  const width = clamp(crop.width, 1, imageWidth - x);
  const height = clamp(crop.height, 1, imageHeight - y);

  return { x, y, width, height };
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function calculatePercentageChange(originalBytes: number, newBytes: number): {
  percentage: number;
  isReduction: boolean;
} {
  if (originalBytes === 0) return { percentage: 0, isReduction: false };
  const diff = originalBytes - newBytes;
  const percentage = Math.abs(Math.round((diff / originalBytes) * 100));
  return {
    percentage,
    isReduction: diff >= 0,
  };
}
