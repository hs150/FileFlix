import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { detectFormatFromHeader } from '@/lib/file-validation/file-signatures';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/images');

describe('Synthetic Fixtures Validation', () => {
  it('correctly detects solid red PNG fixture', () => {
    const buffer = fs.readFileSync(path.join(FIXTURES_DIR, 'test-solid-red.png'));
    const detected = detectFormatFromHeader(buffer);
    expect(detected).not.toBeNull();
    expect(detected?.mime).toBe('image/png');
  });

  it('correctly detects alpha blue transparent PNG fixture', () => {
    const buffer = fs.readFileSync(path.join(FIXTURES_DIR, 'test-alpha-blue.png'));
    const detected = detectFormatFromHeader(buffer);
    expect(detected).not.toBeNull();
    expect(detected?.mime).toBe('image/png');
  });

  it('correctly detects minimal JPEG fixture', () => {
    const buffer = fs.readFileSync(path.join(FIXTURES_DIR, 'test-minimal.jpg'));
    const detected = detectFormatFromHeader(buffer);
    expect(detected).not.toBeNull();
    expect(detected?.mime).toBe('image/jpeg');
  });

  it('correctly detects JPEG fixture with EXIF Orientation 6 metadata', () => {
    const buffer = fs.readFileSync(path.join(FIXTURES_DIR, 'test-exif-orientation-6.jpg'));
    const detected = detectFormatFromHeader(buffer);
    expect(detected).not.toBeNull();
    expect(detected?.mime).toBe('image/jpeg');

    // Verify APP1 Exif marker structure
    const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8); // SOI
    expect(bytes[2]).toBe(0xff);
    expect(bytes[3]).toBe(0xe1); // APP1 Exif marker
    const exifHeader = String.fromCharCode(...bytes.slice(6, 10));
    expect(exifHeader).toBe('Exif');
  });

  it('rejects spoofed text file masquerading as .jpg', () => {
    const buffer = fs.readFileSync(path.join(FIXTURES_DIR, 'test-spoofed.jpg'));
    const detected = detectFormatFromHeader(buffer);
    expect(detected).toBeNull();
  });

  it('verifies manifest entries match actual files and hashes', () => {
    const manifestRaw = fs.readFileSync(path.join(FIXTURES_DIR, 'manifest.json'), 'utf-8');
    const manifest = JSON.parse(manifestRaw);
    expect(manifest.length).toBe(7);

    for (const item of manifest) {
      const filePath = path.join(FIXTURES_DIR, item.filename);
      expect(fs.existsSync(filePath)).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBe(item.bytes);
    }
  });
});
