import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { convertImagesToPdf } from '@/features/converter/lib/image-to-pdf';
import { detectFormatFromHeader } from '@/lib/file-validation/file-signatures';
import { verifyEncodedFormatMagicBytes } from '@/features/converter/lib/image-converter';

const IMAGE_FIXTURES = path.resolve(__dirname, '../fixtures/images');
const PDF_FIXTURES = path.resolve(__dirname, '../fixtures/pdfs');

// Polyfill URL.createObjectURL/revokeObjectURL in Node environment if missing
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock-url-' + Math.random().toString(36).substring(2);
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}

describe('File Conversion System - Integration Tests', () => {
  it('converts single PNG image fixture into valid PDF document', async () => {
    const pngBuffer = fs.readFileSync(path.join(IMAGE_FIXTURES, 'test-solid-red.png'));
    const pngBlob = new Blob([pngBuffer], { type: 'image/png' });

    const result = await convertImagesToPdf(
      [{ blob: pngBlob, name: 'test-solid-red.png' }],
      { pageSize: 'a4', orientation: 'auto', margin: 'small' }
    );

    expect(result.pageCount).toBe(1);
    expect(result.sizeBytes).toBeGreaterThan(100);

    // Verify PDF header %PDF-
    const outBuffer = await result.blob.arrayBuffer();
    const detected = detectFormatFromHeader(outBuffer);
    expect(detected).not.toBeNull();
    expect(detected?.mime).toBe('application/pdf');

    // Parse generated PDF using pdf-lib to ensure valid object tree
    const loadedDoc = await PDFDocument.load(outBuffer);
    expect(loadedDoc.getPageCount()).toBe(1);
  });

  it('converts JPEG image fixture into valid PDF document', async () => {
    const jpgBuffer = fs.readFileSync(path.join(IMAGE_FIXTURES, 'test-minimal.jpg'));
    const jpgBlob = new Blob([jpgBuffer], { type: 'image/jpeg' });

    const result = await convertImagesToPdf(
      [{ blob: jpgBlob, name: 'test-minimal.jpg' }],
      { pageSize: 'fit-image', orientation: 'auto', margin: 'none' }
    );

    expect(result.pageCount).toBe(1);
    const outBuffer = await result.blob.arrayBuffer();
    const detected = detectFormatFromHeader(outBuffer);
    expect(detected?.mime).toBe('application/pdf');

    const loadedDoc = await PDFDocument.load(outBuffer);
    expect(loadedDoc.getPageCount()).toBe(1);
  });

  it('converts multiple images into a multi-page PDF preserving page ordering', async () => {
    const png1 = fs.readFileSync(path.join(IMAGE_FIXTURES, 'test-solid-red.png'));
    const png2 = fs.readFileSync(path.join(IMAGE_FIXTURES, 'test-alpha-blue.png'));
    const jpg3 = fs.readFileSync(path.join(IMAGE_FIXTURES, 'test-minimal.jpg'));

    const items = [
      { blob: new Blob([png1], { type: 'image/png' }), name: 'page-1.png' },
      { blob: new Blob([png2], { type: 'image/png' }), name: 'page-2.png' },
      { blob: new Blob([jpg3], { type: 'image/jpeg' }), name: 'page-3.jpg' },
    ];

    const result = await convertImagesToPdf(
      items,
      { pageSize: 'letter', orientation: 'portrait', margin: 'normal' }
    );

    expect(result.pageCount).toBe(3);
    const outBuffer = await result.blob.arrayBuffer();
    const loadedDoc = await PDFDocument.load(outBuffer);
    expect(loadedDoc.getPageCount()).toBe(3);
  });

  it('rejects corrupt or spoofed image files with descriptive error', async () => {
    const spoofed = fs.readFileSync(path.join(IMAGE_FIXTURES, 'test-spoofed.jpg'));
    const badItem = { blob: new Blob([spoofed]), name: 'fake.jpg' };

    await expect(
      convertImagesToPdf([badItem], { pageSize: 'a4', orientation: 'auto', margin: 'none' })
    ).rejects.toThrow(/invalid image header/i);
  });

  it('validates encoded format magic bytes correctly', async () => {
    // Valid JPEG bytes
    const validJpgBlob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])]);
    await expect(verifyEncodedFormatMagicBytes(validJpgBlob, 'image/jpeg')).resolves.toBeUndefined();

    // Invalid JPEG bytes (mismatch)
    const invalidJpgBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]);
    await expect(verifyEncodedFormatMagicBytes(invalidJpgBlob, 'image/jpeg')).rejects.toThrow(
      /invalid JPEG header/i
    );

    // Valid PNG bytes
    await expect(verifyEncodedFormatMagicBytes(invalidJpgBlob, 'image/png')).resolves.toBeUndefined();
  });
});
