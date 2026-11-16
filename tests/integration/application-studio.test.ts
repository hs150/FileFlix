import { describe, it, expect } from 'vitest';
import {
  APPLICATION_PRESETS,
  getPresetById,
  validatePresetCompliance,
} from '@/features/application-studio/lib/presets';

describe('Application Studio Integration & Boundary Enforcement (v2.0)', () => {
  describe('US Visa Digital Photo (DS-160)', () => {
    const preset = getPresetById('us-visa-ds160');

    it('enforces exact 240 KB upper boundary with no minimum floor', () => {
      // 240 KB exact
      const passReport = validatePresetCompliance(
        { width: 600, height: 600, sizeBytes: 240 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(passReport.overallVerdict).toBe('TECHNICAL_CHECKS_PASSED');

      // 240 KB + 1 byte
      const failReport = validatePresetCompliance(
        { width: 600, height: 600, sizeBytes: 240 * 1024 + 1, format: 'image/jpeg' },
        preset
      );
      expect(failReport.overallVerdict).toBe('TECHNICAL_CHECKS_FAILED');
      const sizeCheck = failReport.items.find((i) => i.id === 'file-size');
      expect(sizeCheck?.status).toBe('TECHNICAL_FAIL');
    });

    it('enforces 600x600 px minimum dimension bounds', () => {
      const failWidth = validatePresetCompliance(
        { width: 599, height: 600, sizeBytes: 100 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(failWidth.overallVerdict).toBe('TECHNICAL_CHECKS_FAILED');
      expect(failWidth.items.find((i) => i.id === 'width')?.status).toBe('TECHNICAL_FAIL');

      const failHeight = validatePresetCompliance(
        { width: 600, height: 599, sizeBytes: 100 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(failHeight.overallVerdict).toBe('TECHNICAL_CHECKS_FAILED');
      expect(failHeight.items.find((i) => i.id === 'height')?.status).toBe('TECHNICAL_FAIL');
    });

    it('identifies unverified technical parameters without claiming they passed', () => {
      const report = validatePresetCompliance(
        { width: 600, height: 600, sizeBytes: 100 * 1024, format: 'image/jpeg' },
        preset
      );

      const srgb = report.items.find((i) => i.id === 'srgb-color');
      expect(srgb?.status).toBe('UNVERIFIED_VISUAL');

      const compression = report.items.find((i) => i.id === 'compression-ratio');
      expect(compression?.status).toBe('UNVERIFIED_VISUAL');
    });
  });

  describe('US Passport Online Renewal (OPR)', () => {
    const preset = getPresetById('us-passport-renewal');

    it('enforces 54 KB lower boundary and 10 MB upper boundary in checker mode', () => {
      // 54 KB - 1 byte
      const failLow = validatePresetCompliance(
        { width: 600, height: 600, sizeBytes: 54 * 1024 - 1, format: 'image/jpeg' },
        preset
      );
      expect(failLow.overallVerdict).toBe('CHECKER_ONLY_MODE');
      expect(failLow.items.find((i) => i.id === 'file-size')?.status).toBe('TECHNICAL_FAIL');

      // Exactly 54 KB
      const passLow = validatePresetCompliance(
        { width: 600, height: 600, sizeBytes: 54 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(passLow.overallVerdict).toBe('CHECKER_ONLY_MODE');
      expect(passLow.items.find((i) => i.id === 'file-size')?.status).toBe('TECHNICAL_PASS');

      // Exactly 10 MB
      const passHigh = validatePresetCompliance(
        { width: 1200, height: 1200, sizeBytes: 10 * 1024 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(passHigh.items.find((i) => i.id === 'file-size')?.status).toBe('TECHNICAL_PASS');

      // 10 MB + 1 byte
      const failHigh = validatePresetCompliance(
        { width: 1200, height: 1200, sizeBytes: 10 * 1024 * 1024 + 1, format: 'image/jpeg' },
        preset
      );
      expect(failHigh.items.find((i) => i.id === 'file-size')?.status).toBe('TECHNICAL_FAIL');
    });
  });

  describe('France / Schengen Visa — Physical Guidance & Unspecified Bounds', () => {
    const preset = getPresetById('france-schengen-visa');

    it('reports pixel dimensions and file size as NOT_SPECIFIED while operating in checker mode', () => {
      const report = validatePresetCompliance(
        { width: 413, height: 531, sizeBytes: 120 * 1024, format: 'image/jpeg' },
        preset
      );

      expect(report.overallVerdict).toBe('CHECKER_ONLY_MODE');

      const widthCheck = report.items.find((i) => i.id === 'width');
      expect(widthCheck?.status).toBe('NOT_SPECIFIED');

      const sizeCheck = report.items.find((i) => i.id === 'file-size');
      expect(sizeCheck?.status).toBe('NOT_SPECIFIED');

      const aspectCheck = report.items.find((i) => i.id === 'aspect-ratio');
      expect(aspectCheck?.status).toBe('TECHNICAL_PASS');

      const faceCheck = report.items.find((i) => i.id === 'face-occupancy');
      expect(faceCheck?.status).toBe('UNVERIFIED_VISUAL');
    });
  });

  describe('UPSC Online Generic FAQ Bounds (20–300 KB)', () => {
    it('verifies UPSC Generic Photo accepts up to 300 KB and rejects >300 KB', () => {
      const preset = getPresetById('upsc-generic-photo');

      // 19.9 KB fails
      const failLow = validatePresetCompliance(
        { width: 350, height: 350, sizeBytes: Math.floor(19.9 * 1024), format: 'image/jpeg' },
        preset
      );
      expect(failLow.overallVerdict).toBe('TECHNICAL_CHECKS_FAILED');

      // 250 KB passes (under old 200 KB assumption, this would have failed; under generic 300 KB FAQ, it passes!)
      const pass250 = validatePresetCompliance(
        { width: 500, height: 500, sizeBytes: 250 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(pass250.overallVerdict).toBe('TECHNICAL_CHECKS_PASSED');

      // 300 KB exact passes
      const pass300 = validatePresetCompliance(
        { width: 500, height: 500, sizeBytes: 300 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(pass300.overallVerdict).toBe('TECHNICAL_CHECKS_PASSED');

      // 301 KB fails
      const fail301 = validatePresetCompliance(
        { width: 500, height: 500, sizeBytes: 301 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(fail301.overallVerdict).toBe('TECHNICAL_CHECKS_FAILED');
    });

    it('verifies UPSC Generic Signature accepts up to 300 KB', () => {
      const preset = getPresetById('upsc-generic-signature');

      // 80 KB passes
      const pass80 = validatePresetCompliance(
        { width: 350, height: 350, sizeBytes: 80 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(pass80.overallVerdict).toBe('TECHNICAL_CHECKS_PASSED');

      // 280 KB passes (UPSC OTR generic FAQ allows up to 300 KB for signature)
      const pass280 = validatePresetCompliance(
        { width: 500, height: 500, sizeBytes: 280 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(pass280.overallVerdict).toBe('TECHNICAL_CHECKS_PASSED');
    });
  });

  describe('SSC Examination-Specific Signature Bounds (CGL vs CHSL)', () => {
    it('strictly enforces 10.0 KB to 20.0 KB file size bounds on SSC CGL 2026 (~2:1)', () => {
      const preset = getPresetById('ssc-cgl-2026-signature');

      // 9.9 KB fails
      const failLow = validatePresetCompliance(
        { width: 472, height: 236, sizeBytes: Math.floor(9.9 * 1024), format: 'image/jpeg' },
        preset
      );
      expect(failLow.overallVerdict).toBe('TECHNICAL_CHECKS_FAILED');

      // 15 KB passes
      const pass15 = validatePresetCompliance(
        { width: 472, height: 236, sizeBytes: 15 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(pass15.overallVerdict).toBe('TECHNICAL_CHECKS_PASSED');

      // 20.1 KB fails
      const failHigh = validatePresetCompliance(
        { width: 472, height: 236, sizeBytes: Math.ceil(20.1 * 1024), format: 'image/jpeg' },
        preset
      );
      expect(failHigh.overallVerdict).toBe('TECHNICAL_CHECKS_FAILED');
    });

    it('strictly enforces 10.0 KB to 20.0 KB file size bounds on SSC CHSL 2026 (~3:1)', () => {
      const preset = getPresetById('ssc-chsl-2026-signature');

      // 9.9 KB fails
      const failLow = validatePresetCompliance(
        { width: 708, height: 236, sizeBytes: Math.floor(9.9 * 1024), format: 'image/jpeg' },
        preset
      );
      expect(failLow.overallVerdict).toBe('TECHNICAL_CHECKS_FAILED');

      // 15 KB passes
      const pass15 = validatePresetCompliance(
        { width: 708, height: 236, sizeBytes: 15 * 1024, format: 'image/jpeg' },
        preset
      );
      expect(pass15.overallVerdict).toBe('TECHNICAL_CHECKS_PASSED');

      // 20.1 KB fails
      const failHigh = validatePresetCompliance(
        { width: 708, height: 236, sizeBytes: Math.ceil(20.1 * 1024), format: 'image/jpeg' },
        preset
      );
      expect(failHigh.overallVerdict).toBe('TECHNICAL_CHECKS_FAILED');
    });

    it('reports pixel dimensions as NOT_SPECIFIED for both SSC CGL and CHSL while checking physical ratio', () => {
      const cgl = getPresetById('ssc-cgl-2026-signature');
      const cglReport = validatePresetCompliance(
        { width: 400, height: 200, sizeBytes: 15 * 1024, format: 'image/jpeg' },
        cgl
      );
      expect(cglReport.items.find((i) => i.id === 'width')?.status).toBe('NOT_SPECIFIED');
      expect(cglReport.items.find((i) => i.id === 'aspect-ratio')?.status).toBe('TECHNICAL_PASS');
      expect(cglReport.items.find((i) => i.id === 'physical-dims')?.expected).toContain('4.0 cm');

      const chsl = getPresetById('ssc-chsl-2026-signature');
      const chslReport = validatePresetCompliance(
        { width: 600, height: 200, sizeBytes: 15 * 1024, format: 'image/jpeg' },
        chsl
      );
      expect(chslReport.items.find((i) => i.id === 'width')?.status).toBe('NOT_SPECIFIED');
      expect(chslReport.items.find((i) => i.id === 'aspect-ratio')?.status).toBe('TECHNICAL_PASS');
      expect(chslReport.items.find((i) => i.id === 'physical-dims')?.expected).toContain('6.0 cm');
    });
  });
});
