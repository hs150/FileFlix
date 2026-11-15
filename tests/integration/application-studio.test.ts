import { describe, it, expect } from 'vitest';
import {
  APPLICATION_PRESETS,
  getPresetById,
  validatePresetCompliance,
} from '@/features/application-studio/lib/presets';

describe('Application Studio Integration & Boundary Enforcement', () => {
  describe('US Visa Digital Photo (DS-160)', () => {
    const preset = getPresetById('us-visa-ds160');

    it('enforces exact 240 KB upper boundary', () => {
      // 240 KB exact
      const passReport = validatePresetCompliance(
        { width: 600, height: 600, sizeBytes: 240 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(passReport.isTechnicallyCompliant).toBe(true);

      // 240 KB + 1 byte
      const failReport = validatePresetCompliance(
        { width: 600, height: 600, sizeBytes: 240 * 1024 + 1, format: 'image/jpeg' },
        preset
      );
      expect(failReport.isTechnicallyCompliant).toBe(false);
      const sizeCheck = failReport.items.find((i) => i.name === 'File Size (KB)');
      expect(sizeCheck?.passed).toBe(false);
    });

    it('enforces 600x600 px minimum dimension bounds', () => {
      const failWidth = validatePresetCompliance(
        { width: 599, height: 600, sizeBytes: 100 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(failWidth.isTechnicallyCompliant).toBe(false);
      expect(failWidth.items.find((i) => i.name === 'Width (pixels)')?.passed).toBe(false);

      const failHeight = validatePresetCompliance(
        { width: 600, height: 599, sizeBytes: 100 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(failHeight.isTechnicallyCompliant).toBe(false);
      expect(failHeight.items.find((i) => i.name === 'Height (pixels)')?.passed).toBe(false);
    });

    it('strictly prohibits non-JPEG formats', () => {
      const pngReport = validatePresetCompliance(
        { width: 600, height: 600, sizeBytes: 100 * 1024, format: 'image/png' },
        preset
      );
      expect(pngReport.isTechnicallyCompliant).toBe(false);

      const webpReport = validatePresetCompliance(
        { width: 600, height: 600, sizeBytes: 100 * 1024, format: 'image/webp' },
        preset
      );
      expect(webpReport.isTechnicallyCompliant).toBe(false);
    });
  });

  describe('US Passport Online Renewal (OPR)', () => {
    const preset = getPresetById('us-passport-renewal');

    it('enforces 54 KB lower boundary and 10 MB upper boundary', () => {
      // 54 KB - 1 byte
      const failLow = validatePresetCompliance(
        { width: 600, height: 600, sizeBytes: 54 * 1024 - 1, format: 'image/jpeg' },
        preset
      );
      expect(failLow.isTechnicallyCompliant).toBe(false);

      // Exactly 54 KB
      const passLow = validatePresetCompliance(
        { width: 600, height: 600, sizeBytes: 54 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(passLow.isTechnicallyCompliant).toBe(true);

      // Exactly 10 MB
      const passHigh = validatePresetCompliance(
        { width: 1200, height: 1200, sizeBytes: 10 * 1024 * 1024, format: 'image/png' },
        preset
      );
      expect(passHigh.isTechnicallyCompliant).toBe(true);

      // 10 MB + 1 byte
      const failHigh = validatePresetCompliance(
        { width: 1200, height: 1200, sizeBytes: 10 * 1024 * 1024 + 1, format: 'image/jpeg' },
        preset
      );
      expect(failHigh.isTechnicallyCompliant).toBe(false);
    });

    it('allows both JPEG and PNG formats', () => {
      const jpeg = validatePresetCompliance(
        { width: 600, height: 600, sizeBytes: 500 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(jpeg.isTechnicallyCompliant).toBe(true);

      const png = validatePresetCompliance(
        { width: 600, height: 600, sizeBytes: 500 * 1024, format: 'image/png' },
        preset
      );
      expect(png.isTechnicallyCompliant).toBe(true);
    });
  });

  describe('Indian Government Exam Portals (UPSC & SSC)', () => {
    it('enforces UPSC Photo boundaries (20 KB to 200 KB, square)', () => {
      const preset = getPresetById('upsc-exam-photo');

      // 19.9 KB fails
      const failLow = validatePresetCompliance(
        { width: 350, height: 350, sizeBytes: Math.floor(19.9 * 1024), format: 'image/jpeg' },
        preset
      );
      expect(failLow.isTechnicallyCompliant).toBe(false);

      // 20.0 KB passes
      const passLow = validatePresetCompliance(
        { width: 350, height: 350, sizeBytes: 20 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(passLow.isTechnicallyCompliant).toBe(true);

      // 200.0 KB passes
      const passHigh = validatePresetCompliance(
        { width: 1000, height: 1000, sizeBytes: 200 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(passHigh.isTechnicallyCompliant).toBe(true);

      // 200.1 KB fails
      const failHigh = validatePresetCompliance(
        { width: 1000, height: 1000, sizeBytes: Math.ceil(200.1 * 1024), format: 'image/jpeg' },
        preset
      );
      expect(failHigh.isTechnicallyCompliant).toBe(false);
    });

    it('enforces SSC Signature strict boundaries (10 KB to 20 KB, 140x60 px)', () => {
      const preset = getPresetById('ssc-exam-signature');

      // 140x60 px, 15 KB -> pass
      const pass = validatePresetCompliance(
        { width: 140, height: 60, sizeBytes: 15 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(pass.isTechnicallyCompliant).toBe(true);

      // 9.9 KB -> fail
      const failLow = validatePresetCompliance(
        { width: 140, height: 60, sizeBytes: Math.floor(9.9 * 1024), format: 'image/jpeg' },
        preset
      );
      expect(failLow.isTechnicallyCompliant).toBe(false);

      // 20.1 KB -> fail
      const failHigh = validatePresetCompliance(
        { width: 140, height: 60, sizeBytes: Math.ceil(20.1 * 1024), format: 'image/jpeg' },
        preset
      );
      expect(failHigh.isTechnicallyCompliant).toBe(false);

      // 140x50 px -> fail height
      const failDim = validatePresetCompliance(
        { width: 140, height: 50, sizeBytes: 15 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(failDim.isTechnicallyCompliant).toBe(false);
    });
  });

  describe('Aspect Ratio Tolerance Calculation', () => {
    it('flags aspect ratio discrepancies exceeding 5% tolerance', () => {
      const preset = getPresetById('us-visa-ds160'); // 1:1 ratio
      // 600 x 660 px -> ratio is 600/660 = 0.909 (delta ~0.091 > 0.05)
      const report = validatePresetCompliance(
        { width: 600, height: 660, sizeBytes: 100 * 1024, format: 'image/jpeg' },
        preset
      );
      const ratioCheck = report.items.find((i) => i.name === 'Aspect Ratio');
      expect(ratioCheck?.passed).toBe(false);
    });

    it('passes aspect ratio within 5% tolerance', () => {
      const preset = getPresetById('us-visa-ds160'); // 1:1 ratio
      // 600 x 605 px -> ratio is 600/605 = 0.9917 (delta ~0.0083 < 0.05)
      const report = validatePresetCompliance(
        { width: 600, height: 605, sizeBytes: 100 * 1024, format: 'image/jpeg' },
        preset
      );
      const ratioCheck = report.items.find((i) => i.name === 'Aspect Ratio');
      expect(ratioCheck?.passed).toBe(true);
    });
  });
});
