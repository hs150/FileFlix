import { describe, it, expect } from 'vitest';
import {
  calculateAspectRatio,
  calculateHeightFromWidth,
  calculateWidthFromHeight,
  clampCropBox,
  formatBytes,
  calculatePercentageChange,
} from '@/features/image-studio/lib/image-math';

describe('Image Math Helpers', () => {
  it('calculates aspect ratio correctly', () => {
    expect(calculateAspectRatio(1920, 1080)).toBeCloseTo(1.777, 2);
    expect(calculateAspectRatio(1000, 1000)).toBe(1);
    expect(calculateAspectRatio(800, 0)).toBe(1);
  });

  it('calculates proportional dimensions', () => {
    const ratio = 1920 / 1080;
    expect(calculateHeightFromWidth(960, ratio)).toBe(540);
    expect(calculateWidthFromHeight(540, ratio)).toBe(960);
  });

  it('clamps crop box within image boundaries', () => {
    const clamped = clampCropBox({ x: -10, y: -20, width: 3000, height: 2000 }, 1920, 1080);
    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(0);
    expect(clamped.width).toBe(1920);
    expect(clamped.height).toBe(1080);
  });

  it('formats byte strings accurately', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(5242880)).toBe('5 MB');
  });

  it('calculates percentage changes correctly', () => {
    expect(calculatePercentageChange(1000, 600)).toEqual({ percentage: 40, isReduction: true });
    expect(calculatePercentageChange(1000, 1200)).toEqual({ percentage: 20, isReduction: false });
  });
});
