import { describe, it, expect } from 'vitest';
import {
  APPLICATION_PRESETS,
  APPLICATION_PRESETS_VERSION,
  getPresetById,
  validatePresetCompliance,
} from '@/features/application-studio/lib/presets';
import {
  calculateCenterCrop,
  calculatePadFit,
} from '@/features/application-studio/lib/aspect-math';

describe('Application Studio Presets & Validation Specification', () => {
  it('has a valid version and complete preset catalog', () => {
    expect(APPLICATION_PRESETS_VERSION).toBe('1.0.0');
    expect(APPLICATION_PRESETS.length).toBe(7);

    for (const preset of APPLICATION_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.issuingAuthority).toBeTruthy();
      expect(preset.applicationType).toBeTruthy();
      expect(preset.minWidth).toBeGreaterThan(0);
      expect(preset.maxWidth).toBeGreaterThanOrEqual(preset.minWidth);
      expect(preset.minHeight).toBeGreaterThan(0);
      expect(preset.maxHeight).toBeGreaterThanOrEqual(preset.minHeight);
      expect(preset.minBytes).toBeGreaterThan(0);
      expect(preset.maxBytes).toBeGreaterThan(preset.minBytes);
      expect(preset.allowedFormats.length).toBeGreaterThan(0);
      expect(preset.constraints.length).toBeGreaterThan(0);
      expect(preset.warnings.length).toBeGreaterThan(0);
      expect(['photo', 'signature', 'custom']).toContain(preset.category);
    }
  });

  describe('Official Preset Specifications Accuracy', () => {
    it('verifies US Visa (DS-160) rules', () => {
      const p = getPresetById('us-visa-ds160');
      expect(p.category).toBe('photo');
      expect(p.minWidth).toBe(600);
      expect(p.maxWidth).toBe(1200);
      expect(p.minHeight).toBe(600);
      expect(p.maxHeight).toBe(1200);
      expect(p.maxBytes).toBe(240 * 1024); // 240 KB
      expect(p.allowedFormats).toEqual(['image/jpeg']);
      expect(p.requiresUneditedOriginal).toBe(true);
      expect(p.officialSourceUrl).toContain('travel.state.gov');
    });

    it('verifies US Passport Online Renewal (OPR) rules', () => {
      const p = getPresetById('us-passport-renewal');
      expect(p.category).toBe('photo');
      expect(p.minWidth).toBe(600);
      expect(p.maxWidth).toBe(1200);
      expect(p.minBytes).toBe(54 * 1024); // 54 KB exact official min
      expect(p.maxBytes).toBe(10 * 1024 * 1024); // 10 MB exact official max
      expect(p.allowedFormats).toContain('image/jpeg');
      expect(p.allowedFormats).toContain('image/png');
      expect(p.requiresUneditedOriginal).toBe(true);
    });

    it('verifies Schengen Visa (France-Visas) rules', () => {
      const p = getPresetById('schengen-visa-france');
      expect(p.category).toBe('photo');
      expect(p.minWidth).toBe(413);
      expect(p.minHeight).toBe(531);
      expect(p.aspectRatio.width).toBe(7);
      expect(p.aspectRatio.height).toBe(9);
      expect(p.maxBytes).toBe(300 * 1024); // 300 KB
      expect(p.allowedFormats).toEqual(['image/jpeg']);
    });

    it('verifies UPSC Examination Photo rules', () => {
      const p = getPresetById('upsc-exam-photo');
      expect(p.category).toBe('photo');
      expect(p.minWidth).toBe(350);
      expect(p.maxWidth).toBe(1000);
      expect(p.minBytes).toBe(20 * 1024); // 20 KB
      expect(p.maxBytes).toBe(200 * 1024); // 200 KB
      expect(p.allowedFormats).toEqual(['image/jpeg']);
    });

    it('verifies UPSC Examination Signature rules', () => {
      const p = getPresetById('upsc-exam-signature');
      expect(p.category).toBe('signature');
      expect(p.minWidth).toBe(350);
      expect(p.maxWidth).toBe(1000);
      expect(p.minBytes).toBe(20 * 1024); // 20 KB
      expect(p.maxBytes).toBe(100 * 1024); // 100 KB
      expect(p.defaultFittingMode).toBe('pad-white');
    });

    it('verifies SSC Examination Signature rules', () => {
      const p = getPresetById('ssc-exam-signature');
      expect(p.category).toBe('signature');
      expect(p.minWidth).toBe(140);
      expect(p.minHeight).toBe(60);
      expect(p.exactWidth).toBe(140);
      expect(p.exactHeight).toBe(60);
      expect(p.minBytes).toBe(10 * 1024); // 10 KB
      expect(p.maxBytes).toBe(20 * 1024); // 20 KB
      expect(p.defaultFittingMode).toBe('pad-white');
      expect(p.warnings.some((w) => w.includes('NO LONGER accepts uploaded photograph'))).toBe(true);
    });
  });

  describe('Compliance Verification Engine', () => {
    it('passes a fully compliant US Visa photo', () => {
      const preset = getPresetById('us-visa-ds160');
      const report = validatePresetCompliance(
        {
          width: 600,
          height: 600,
          sizeBytes: 150 * 1024,
          format: 'image/jpeg',
        },
        preset
      );

      expect(report.isTechnicallyCompliant).toBe(true);
      expect(report.items.every((i) => i.passed)).toBe(true);
      expect(report.biometricDisclaimer).toContain('does NOT guarantee biometric acceptance');
    });

    it('fails when file size exceeds official ceiling (US Visa > 240 KB)', () => {
      const preset = getPresetById('us-visa-ds160');
      const report = validatePresetCompliance(
        {
          width: 600,
          height: 600,
          sizeBytes: 246 * 1024, // 246 KB > 240 KB limit
          format: 'image/jpeg',
        },
        preset
      );

      expect(report.isTechnicallyCompliant).toBe(false);
      const sizeItem = report.items.find((i) => i.name === 'File Size (KB)');
      expect(sizeItem?.passed).toBe(false);
    });

    it('fails when dimensions are below official floor (UPSC Photo < 350 px)', () => {
      const preset = getPresetById('upsc-exam-photo');
      const report = validatePresetCompliance(
        {
          width: 300,
          height: 300,
          sizeBytes: 50 * 1024,
          format: 'image/jpeg',
        },
        preset
      );

      expect(report.isTechnicallyCompliant).toBe(false);
      const widthItem = report.items.find((i) => i.name === 'Width (pixels)');
      expect(widthItem?.passed).toBe(false);
    });

    it('fails when image format is prohibited (SSC Signature in PNG)', () => {
      const preset = getPresetById('ssc-exam-signature');
      const report = validatePresetCompliance(
        {
          width: 140,
          height: 60,
          sizeBytes: 15 * 1024,
          format: 'image/png',
        },
        preset
      );

      expect(report.isTechnicallyCompliant).toBe(false);
      const formatItem = report.items.find((i) => i.name === 'Image Format');
      expect(formatItem?.passed).toBe(false);
    });
  });

  describe('Aspect Ratio Fitting Math', () => {
    it('calculates center-crop for wider images (crop left & right)', () => {
      // 800x600 image to 600x600 target (1:1)
      const crop = calculateCenterCrop(800, 600, 600, 600);
      expect(crop.width).toBe(600);
      expect(crop.height).toBe(600);
      expect(crop.x).toBe(100);
      expect(crop.y).toBe(0);
    });

    it('calculates center-crop for taller images (crop top & bottom)', () => {
      // 600x800 image to 600x600 target (1:1)
      const crop = calculateCenterCrop(600, 800, 600, 600);
      expect(crop.width).toBe(600);
      expect(crop.height).toBe(600);
      expect(crop.x).toBe(0);
      expect(crop.y).toBe(100);
    });

    it('calculates pad-fit scaling and centering without cropping', () => {
      // Signature 500x200 inside 350x350 target
      const pad = calculatePadFit(500, 200, 350, 350);
      // scale = 350 / 500 = 0.7
      expect(pad.drawWidth).toBe(350);
      expect(pad.drawHeight).toBe(140);
      expect(pad.destX).toBe(0);
      expect(pad.destY).toBe((350 - 140) / 2);
      expect(pad.targetWidth).toBe(350);
      expect(pad.targetHeight).toBe(350);
    });

    it('calculates pad-fit for exact ratio (no offsets)', () => {
      const pad = calculatePadFit(280, 120, 140, 60);
      expect(pad.drawWidth).toBe(140);
      expect(pad.drawHeight).toBe(60);
      expect(pad.destX).toBe(0);
      expect(pad.destY).toBe(0);
    });
  });
});
