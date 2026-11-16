import { describe, it, expect } from 'vitest';
import { createZipArchive, createZipBlob, crc32 } from '@/lib/zip/zip-writer';

describe('Zero-Dependency Client ZIP Writer', () => {
  it('calculates IEEE 802.3 CRC32 correctly for standard test vectors', () => {
    // Standard test vector: "123456789" => 0xcbf43926
    const data = new TextEncoder().encode('123456789');
    const checksum = crc32(data);
    expect(checksum).toBe(0xcbf43926);
  });

  it('generates valid ZIP archive header with correct magic bytes', () => {
    const file1 = {
      name: 'hello.txt',
      data: new TextEncoder().encode('Hello World'),
    };
    const zipBytes = createZipArchive([file1]);

    // Check magic bytes PK\x03\x04 (0x50 0x4B 0x03 0x04)
    expect(zipBytes[0]).toBe(0x50);
    expect(zipBytes[1]).toBe(0x4b);
    expect(zipBytes[2]).toBe(0x03);
    expect(zipBytes[3]).toBe(0x04);

    // Verify EOCD signature PK\x05\x06 at the end
    const len = zipBytes.length;
    expect(zipBytes[len - 22]).toBe(0x50);
    expect(zipBytes[len - 21]).toBe(0x4b);
    expect(zipBytes[len - 20]).toBe(0x05);
    expect(zipBytes[len - 19]).toBe(0x06);
  });

  it('packs multiple files into a single valid zip archive blob', () => {
    const files = [
      { name: 'page-1.jpg', data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]) },
      { name: 'page-2.jpg', data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]) },
      { name: 'readme.txt', data: new TextEncoder().encode('Extracted pages from FileFix') },
    ];

    const blob = createZipBlob(files);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/zip');
    expect(blob.size).toBeGreaterThan(60);
  });
});
