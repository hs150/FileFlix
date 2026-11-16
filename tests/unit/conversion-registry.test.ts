import { describe, it, expect } from 'vitest';
import {
  CONVERSION_CAPABILITY_REGISTRY,
  getVerifiedConversions,
  getConversionById,
  getSupportedConversionsForMime,
  isConversionSupported,
  findConversion,
} from '@/features/converter/lib/registry';

describe('Conversion Capability Registry', () => {
  it('contains comprehensive metadata for all registered conversions', () => {
    expect(CONVERSION_CAPABILITY_REGISTRY.length).toBeGreaterThan(0);

    for (const def of CONVERSION_CAPABILITY_REGISTRY) {
      expect(def.id).toBeTruthy();
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.inputMime).toContain('/');
      expect(def.outputMime).toContain('/');
      expect(def.inputExtension).toBeTruthy();
      expect(def.outputExtension).toBeTruthy();
      expect(def.engine).toBeTruthy();
      expect(typeof def.isBrowserLocal).toBe('boolean');
      expect(typeof def.preservesLossless).toBe('boolean');
      expect(typeof def.preservesTransparency).toBe('boolean');
      expect(typeof def.preservesAnimation).toBe('boolean');
      expect(Array.isArray(def.knownLimitations)).toBe(true);
      expect(def.knownLimitations.length).toBeGreaterThan(0);
      expect(def.lossinessExplanation).toBeTruthy();
      expect(['VERIFIED_LOCAL', 'PLANNED', 'UNSUPPORTED']).toContain(def.verificationStatus);
    }
  });

  it('guarantees that all VERIFIED_LOCAL conversions run browser-locally with zero server requirement', () => {
    const verified = getVerifiedConversions();
    expect(verified.length).toBeGreaterThanOrEqual(10);

    for (const def of verified) {
      expect(def.isBrowserLocal).toBe(true);
      expect(def.verificationStatus).toBe('VERIFIED_LOCAL');
      expect(def.maxTestedSizeBytes).toBeGreaterThan(0);
    }
  });

  it('correctly maps supported conversions for JPEG', () => {
    const jpegConversions = getSupportedConversionsForMime('image/jpeg');
    const targetMimes = jpegConversions.map((c) => c.outputMime);

    expect(targetMimes).toContain('image/png');
    expect(targetMimes).toContain('image/webp');
    expect(targetMimes).toContain('application/pdf');
    expect(targetMimes).not.toContain('video/mp4');
  });

  it('correctly maps supported conversions for PNG', () => {
    const pngConversions = getSupportedConversionsForMime('image/png');
    const targetMimes = pngConversions.map((c) => c.outputMime);

    expect(targetMimes).toContain('image/jpeg');
    expect(targetMimes).toContain('image/webp');
    expect(targetMimes).toContain('application/pdf');
  });

  it('correctly maps supported conversions for PDF', () => {
    const pdfConversions = getSupportedConversionsForMime('application/pdf');
    const targetMimes = pdfConversions.map((c) => c.outputMime);

    expect(targetMimes).toContain('image/jpeg');
    expect(targetMimes).toContain('image/png');
    expect(targetMimes).not.toContain('image/webp');
  });

  it('rejects unsupported or unverified conversions', () => {
    expect(isConversionSupported('image/jpeg', 'video/mp4')).toBe(false);
    expect(isConversionSupported('application/pdf', 'application/vnd.ms-excel')).toBe(false);
    expect(isConversionSupported('image/png', 'text/plain')).toBe(false);
  });

  it('retrieves conversion by ID and specific MIME pair correctly', () => {
    const pngToJpg = getConversionById('png-to-jpg');
    expect(pngToJpg).toBeDefined();
    expect(pngToJpg?.inputMime).toBe('image/png');
    expect(pngToJpg?.outputMime).toBe('image/jpeg');
    expect(pngToJpg?.preservesTransparency).toBe(false);

    const found = findConversion('image/jpeg', 'application/pdf');
    expect(found).toBeDefined();
    expect(found?.id).toBe('jpg-to-pdf');
  });
});
