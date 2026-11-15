import { describe, it, expect } from 'vitest';
import { detectFormatFromHeader, validateImageFile, FileValidationError } from '@/lib/file-validation/file-signatures';

describe('Magic-byte format detection', () => {
  it('detects JPEG headers correctly', () => {
    const jpegBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]).buffer;
    const detected = detectFormatFromHeader(jpegBuffer);
    expect(detected).not.toBeNull();
    expect(detected?.mime).toBe('image/jpeg');
    expect(detected?.extension).toBe('jpg');
  });

  it('detects PNG headers correctly', () => {
    const pngBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).buffer;
    const detected = detectFormatFromHeader(pngBuffer);
    expect(detected).not.toBeNull();
    expect(detected?.mime).toBe('image/png');
    expect(detected?.extension).toBe('png');
  });

  it('detects WebP headers correctly', () => {
    // RIFF [4 bytes size] WEBP
    const webpBuffer = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // size
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]).buffer;
    const detected = detectFormatFromHeader(webpBuffer);
    expect(detected).not.toBeNull();
    expect(detected?.mime).toBe('image/webp');
    expect(detected?.extension).toBe('webp');
  });

  it('detects PDF headers correctly', () => {
    const pdfBuffer = new TextEncoder().encode('%PDF-1.7\nSample text').buffer;
    const detected = detectFormatFromHeader(pdfBuffer);
    expect(detected).not.toBeNull();
    expect(detected?.mime).toBe('application/pdf');
    expect(detected?.extension).toBe('pdf');
  });

  it('rejects text files with spoofed extensions', () => {
    const fakeBuffer = new TextEncoder().encode('Hello, this is just plain text').buffer;
    const detected = detectFormatFromHeader(fakeBuffer);
    expect(detected).toBeNull();
  });

  it('rejects empty buffers', () => {
    const emptyBuffer = new Uint8Array(0).buffer;
    const detected = detectFormatFromHeader(emptyBuffer);
    expect(detected).toBeNull();
  });
});
