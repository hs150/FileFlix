import { describe, it, expect } from 'vitest';
import * as fflate from 'fflate';
import { executeConversion } from '@/features/conversion-engine/core/conversion-executor';
import { ConversionInput } from '@/features/conversion-engine/core/conversion-types';
import { extractTarArchive, createTarArchive } from '@/features/conversion-engine/adapters/archive/tar-engine';
import { sanitizeArchiveEntryPath, checkDecompressionSafety } from '@/features/conversion-engine/adapters/archive/security-guards';

describe('Archive Conversions Integration', () => {
  const encoder = new TextEncoder();

  it('converts ZIP archive to POSIX ustar TAR format losslessly', async () => {
    // Create in-memory ZIP with 2 files
    const zipData = fflate.zipSync({
      'file1.txt': encoder.encode('Hello FileFix TAR'),
      'docs/readme.md': encoder.encode('# Documentation\nFileFix Archive Converter'),
    });

    const input: ConversionInput = {
      file: new Blob([zipData.buffer as ArrayBuffer], { type: 'application/zip' }),
      name: 'bundle.zip',
      sizeBytes: zipData.length,
      detectedFormat: {
        formatId: 'zip',
        mime: 'application/zip',
        extension: 'zip',
        name: 'ZIP Archive',
        category: 'archive',
        isTextBased: false,
        confidence: 'magic_bytes',
      },
      buffer: zipData.buffer as ArrayBuffer,
    };

    const result = await executeConversion(input, 'tar');
    expect(result.mime).toBe('application/x-tar');
    expect(result.filename).toBe('bundle.tar');

    // Verify TAR header structure by extracting entries back
    const tarBuf = await result.blob.arrayBuffer();
    const extracted = extractTarArchive(tarBuf);

    expect(extracted.length).toBe(2);
    expect(extracted.map((e) => e.name)).toContain('file1.txt');
    expect(extracted.map((e) => e.name)).toContain('docs/readme.md');

    const file1Entry = extracted.find((e) => e.name === 'file1.txt');
    expect(new TextDecoder().decode(file1Entry?.data)).toBe('Hello FileFix TAR');
  });

  it('converts TAR archive to standard compressed ZIP format', async () => {
    const tarData = createTarArchive([
      { name: 'config.json', data: encoder.encode('{"theme":"dark"}'), size: 16 },
      { name: 'notes.txt', data: encoder.encode('Important notes'), size: 15 },
    ]);

    const input: ConversionInput = {
      file: new Blob([tarData.buffer as ArrayBuffer], { type: 'application/x-tar' }),
      name: 'archive.tar',
      sizeBytes: tarData.length,
      detectedFormat: {
        formatId: 'tar',
        mime: 'application/x-tar',
        extension: 'tar',
        name: 'TAR Tape Archive',
        category: 'archive',
        isTextBased: false,
        confidence: 'magic_bytes',
      },
      buffer: tarData.buffer as ArrayBuffer,
    };

    const result = await executeConversion(input, 'zip');
    expect(result.mime).toBe('application/zip');
    expect(result.filename).toBe('archive.zip');

    // Decompress generated ZIP and verify contents
    const zipBuf = await result.blob.arrayBuffer();
    const unzipped = fflate.unzipSync(new Uint8Array(zipBuf));

    expect(Object.keys(unzipped)).toContain('config.json');
    expect(new TextDecoder().decode(unzipped['config.json'])).toBe('{"theme":"dark"}');
  });

  it('deboxes and decompresses GZIP wrapper from TAR.GZ archive', async () => {
    const tarBytes = createTarArchive([
      { name: 'data.txt', data: encoder.encode('Sample GZIP stream test'), size: 23 },
    ]);
    const gzBytes = fflate.gzipSync(tarBytes);

    const input: ConversionInput = {
      file: new Blob([gzBytes.buffer as ArrayBuffer], { type: 'application/gzip' }),
      name: 'package.tar.gz',
      sizeBytes: gzBytes.length,
      detectedFormat: {
        formatId: 'tar.gz',
        mime: 'application/gzip',
        extension: 'tar.gz',
        name: 'TAR.GZ Compressed Archive',
        category: 'archive',
        isTextBased: false,
        confidence: 'magic_bytes',
      },
      buffer: gzBytes.buffer as ArrayBuffer,
    };

    const result = await executeConversion(input, 'tar');
    expect(result.mime).toBe('application/x-tar');
    expect(result.filename).toBe('package.tar');
  });

  it('rejects Zip Slip directory traversal paths with SecurityValidationError', () => {
    expect(() => sanitizeArchiveEntryPath('../../etc/passwd')).toThrow(/traversal/i);
    expect(() => sanitizeArchiveEntryPath('safe/../../windows/system32/cmd.exe')).toThrow(/traversal/i);
    expect(() => sanitizeArchiveEntryPath('/root/secrets.txt')).toThrow(/absolute path/i);
    expect(() => sanitizeArchiveEntryPath('C:\\Windows\\System32')).toThrow(/absolute path/i);
    expect(() => sanitizeArchiveEntryPath('NUL')).toThrow(/reserved/i);
  });

  it('detects and halts decompression bomb characteristics', () => {
    // 1000 KB expanded from 1 KB => 1000:1 ratio exceeds 100:1 bomb limit
    expect(() => checkDecompressionSafety(1, 1000 * 1024, 1000 * 1024, 1024)).toThrow(
      /decompression bomb/i
    );

    // Exceeding max entry count
    expect(() => checkDecompressionSafety(1001, 5000, 10, 1000)).toThrow(/maximum allowed entry count/i);
  });
});
