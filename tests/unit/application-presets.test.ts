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

describe('Application Studio Presets & Validation Architecture (v2.0)', () => {
  it('has a valid version and complete preset catalog', () => {
    expect(APPLICATION_PRESETS_VERSION).toBe('2.0.0');
    expect(APPLICATION_PRESETS.length).toBeGreaterThanOrEqual(6);

    for (const preset of APPLICATION_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.displayName).toBeTruthy();
      expect(preset.country).toBeTruthy();
      expect(preset.issuingAuthority).toBeTruthy();
      expect(preset.applicationName).toBeTruthy();
      expect(['photo', 'signature', 'custom']).toContain(preset.category);
      expect(['transform', 'checker-only']).toContain(preset.mode);
      expect(preset.verificationDate).toBe('2026-11-16');
      expect(preset.allowedOutputFormats.length).toBeGreaterThan(0);
      expect(preset.scopeAndLimitations).toBeTruthy();
      expect(Array.isArray(preset.fileFixRecommendations)).toBe(true);
    }
  });

  describe('Official Primary Source Integrity Checks', () => {
    it('verifies U.S. Visa DS-160 exact official rules', () => {
      const p = getPresetById('us-visa-ds160');
      expect(p.category).toBe('photo');
      expect(p.mode).toBe('transform');
      expect(p.pixelDimensions.isSpecified).toBe(true);
      expect(p.pixelDimensions.minWidth).toBe(600);
      expect(p.pixelDimensions.maxWidth).toBe(1200);
      expect(p.pixelDimensions.minHeight).toBe(600);
      expect(p.pixelDimensions.maxHeight).toBe(1200);
      expect(p.aspectRatio.description).toBe('1:1 (Square)');
      expect(p.fileSize.isSpecified).toBe(true);
      expect(p.fileSize.maxBytes).toBe(240 * 1024); // 240 KB
      expect(p.allowedOutputFormats).toEqual(['image/jpeg']);
      expect(p.requiresOriginalUnedited).toBe(true);
      expect(p.softwareTransformationPermitted).toBe(true);
      expect(p.officialSourceUrl).toBe(
        'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos/digital-image-requirements.html'
      );
    });

    it('verifies U.S. Passport Renewal (OPR) checker-only mode and anti-alteration policy', () => {
      const p = getPresetById('us-passport-renewal');
      expect(p.category).toBe('photo');
      expect(p.mode).toBe('checker-only');
      expect(p.softwareTransformationPermitted).toBe(false); // Disallows software editing!
      expect(p.requiresOriginalUnedited).toBe(true);
      expect(p.fileSize.minBytes).toBe(54 * 1024); // 54 KB exact official floor
      expect(p.fileSize.maxBytes).toBe(10 * 1024 * 1024); // 10 MB exact official ceiling
      expect(p.pixelDimensions.minWidth).toBe(600);
      expect(p.pixelDimensions.maxWidth).toBe(1200);
      expect(p.officialSourceUrl).toBe(
        'https://travel.state.gov/en/passports/renew-replace/online/upload-digital-photo.html'
      );
      expect(p.warningNotice).toContain('INSTRUCTION & REQUIREMENTS CHECKER MODE');
    });

    it('verifies France / Schengen Visa physical guidance and unspecified digital bounds', () => {
      const p = getPresetById('france-schengen-visa');
      expect(p.category).toBe('photo');
      // Must NOT claim universal pixel dimensions or 300 KB when central FAQ does not specify them
      expect(p.pixelDimensions.isSpecified).toBe(false);
      expect(p.fileSize.isSpecified).toBe(false);
      expect(p.physicalDimensions?.isSpecified).toBe(true);
      expect(p.physicalDimensions?.widthMm).toBe(35);
      expect(p.physicalDimensions?.heightMm).toBe(45);
      expect(p.physicalDimensions?.faceHeightMinMm).toBe(32);
      expect(p.physicalDimensions?.faceHeightMaxMm).toBe(36);
      expect(p.aspectRatio.description).toContain('7:9');
      expect(p.faceOccupancy?.minPercent).toBe(70);
      expect(p.faceOccupancy?.maxPercent).toBe(80);
      expect(p.isExamSpecificOrVolatile).toBe(true);
      expect(p.officialSourceUrl).toBe('https://www.france-visas.gouv.fr/en/faq');
    });

    it('verifies UPSC Generic FAQ size bounds (20–300 KB for photo and signature)', () => {
      const photo = getPresetById('upsc-generic-photo');
      expect(photo.fileSize.minBytes).toBe(20 * 1024); // 20 KB
      expect(photo.fileSize.maxBytes).toBe(300 * 1024); // 300 KB (UPSC OTR Generic FAQ!)
      expect(photo.pixelDimensions.minWidth).toBe(350);
      expect(photo.pixelDimensions.maxWidth).toBe(1000);
      expect(photo.officialSourceUrl).toBe('https://upsconline.gov.in/upsc/OTRP/candidate/faq.php');

      const sig = getPresetById('upsc-generic-signature');
      expect(sig.fileSize.minBytes).toBe(20 * 1024);
      expect(sig.fileSize.maxBytes).toBe(300 * 1024);
      expect(sig.defaultFittingMode).toBe('pad-white');
    });

    it('verifies SSC Examination signature bounds (10–20 KB, ~6x2 cm) without universal pixel claims', () => {
      const p = getPresetById('ssc-exam-signature');
      expect(p.category).toBe('signature');
      expect(p.fileSize.minBytes).toBe(10 * 1024); // 10.0 KB
      expect(p.fileSize.maxBytes).toBe(20 * 1024); // 20.0 KB
      expect(p.pixelDimensions.isSpecified).toBe(false); // Does NOT claim universal 140x60 px
      expect(p.physicalDimensions?.isSpecified).toBe(true);
      expect(p.physicalDimensions?.widthCm).toBe(6.0);
      expect(p.physicalDimensions?.heightCm).toBe(2.0);
      expect(p.defaultFittingMode).toBe('pad-white');
      expect(p.warningNotice).toContain('SSC NO LONGER accepts uploaded photograph files');
    });
  });

  describe('Validation Engine — Status Transparency & Distinction', () => {
    it('produces TECHNICAL_CHECKS_PASSED when official technical requirements pass', () => {
      const preset = getPresetById('us-visa-ds160');
      const report = validatePresetCompliance(
        { width: 600, height: 600, sizeBytes: 150 * 1024, format: 'image/jpeg' },
        preset
      );

      expect(report.overallVerdict).toBe('TECHNICAL_CHECKS_PASSED');
      expect(report.verdictTitle).toBe('Technical checks passed');

      // Check that sRGB and compression ratio are explicitly marked as UNVERIFIED_VISUAL
      const srgbCheck = report.items.find((i) => i.id === 'srgb-color');
      expect(srgbCheck?.status).toBe('UNVERIFIED_VISUAL');
      expect(srgbCheck?.statusLabel).toBe('Visual requirement not automatically verified');

      const compCheck = report.items.find((i) => i.id === 'compression-ratio');
      expect(compCheck?.status).toBe('UNVERIFIED_VISUAL');

      // Check unverified visual notice is present
      expect(report.unverifiedVisualNotice).toContain('Visual requirements not automatically verified');
      // Check unedited photo warning is present
      expect(report.uneditedPhotoWarning).toContain('requires an original, unedited photograph');
    });

    it('produces TECHNICAL_CHECKS_FAILED when official boundaries are violated', () => {
      const preset = getPresetById('upsc-generic-photo');
      // 15 KB is below UPSC 20 KB floor
      const report = validatePresetCompliance(
        { width: 350, height: 350, sizeBytes: 15 * 1024, format: 'image/jpeg' },
        preset
      );

      expect(report.overallVerdict).toBe('TECHNICAL_CHECKS_FAILED');
      expect(report.verdictTitle).toBe('Technical checks failed');
      const sizeCheck = report.items.find((i) => i.id === 'file-size');
      expect(sizeCheck?.status).toBe('TECHNICAL_FAIL');
    });

    it('handles NOT_SPECIFIED items correctly when official rules do not mandate pixels or KB', () => {
      const preset = getPresetById('france-schengen-visa');
      const report = validatePresetCompliance(
        { width: 413, height: 531, sizeBytes: 80 * 1024, format: 'image/jpeg' },
        preset
      );

      const widthCheck = report.items.find((i) => i.id === 'width');
      expect(widthCheck?.status).toBe('NOT_SPECIFIED');
      expect(widthCheck?.statusLabel).toBe('Official requirement not specified');

      const sizeCheck = report.items.find((i) => i.id === 'file-size');
      expect(sizeCheck?.status).toBe('NOT_SPECIFIED');

      // But aspect ratio (7:9) is verified!
      const aspectCheck = report.items.find((i) => i.id === 'aspect-ratio');
      expect(aspectCheck?.status).toBe('TECHNICAL_PASS');
    });

    it('correctly enters CHECKER_ONLY_MODE for U.S. Passport Renewal', () => {
      const preset = getPresetById('us-passport-renewal');
      const report = validatePresetCompliance(
        { width: 800, height: 800, sizeBytes: 300 * 1024, format: 'image/jpeg' },
        preset
      );

      expect(report.overallVerdict).toBe('CHECKER_ONLY_MODE');
      expect(report.verdictDescription).toContain('U.S. Passport Renewal strictly prohibits software alterations');
    });

    it('flags prohibited formats as TECHNICAL_FAIL', () => {
      const preset = getPresetById('us-visa-ds160');
      const report = validatePresetCompliance(
        { width: 600, height: 600, sizeBytes: 100 * 1024, format: 'image/png' },
        preset
      );

      expect(report.overallVerdict).toBe('TECHNICAL_CHECKS_FAILED');
      const formatCheck = report.items.find((i) => i.id === 'format');
      expect(formatCheck?.status).toBe('TECHNICAL_FAIL');
    });
  });

  describe('Aspect Ratio Fitting Math', () => {
    it('calculates center-crop for wider images (crop left & right)', () => {
      const crop = calculateCenterCrop(800, 600, 600, 600);
      expect(crop.width).toBe(600);
      expect(crop.height).toBe(600);
      expect(crop.x).toBe(100);
      expect(crop.y).toBe(0);
    });

    it('calculates center-crop for taller images (crop top & bottom)', () => {
      const crop = calculateCenterCrop(600, 800, 600, 600);
      expect(crop.width).toBe(600);
      expect(crop.height).toBe(600);
      expect(crop.x).toBe(0);
      expect(crop.y).toBe(100);
    });

    it('calculates pad-fit scaling and centering without cropping', () => {
      const pad = calculatePadFit(500, 200, 350, 350);
      expect(pad.drawWidth).toBe(350);
      expect(pad.drawHeight).toBe(140);
      expect(pad.destX).toBe(0);
      expect(pad.destY).toBe((350 - 140) / 2);
    });
  });
});
