import * as fflate from 'fflate';
import { ConversionAdapter, ConversionInput, ConversionOutput } from '../../core/conversion-types';
import { ConversionError } from '../../core/conversion-errors';
import { sanitizeArchiveEntryPath, checkDecompressionSafety } from './security-guards';
import { createTarArchive, extractTarArchive } from './tar-engine';

export const archiveAdapter: ConversionAdapter = {
  id: 'archive-adapter',
  category: 'archive',
  supportedPairs: [
    { input: 'zip', output: 'tar' },
    { input: 'tar', output: 'zip' },
    { input: 'gzip', output: 'txt' }, // or uncompressed
    { input: 'tar.gz', output: 'tar' },
    { input: 'tar.gz', output: 'zip' },
    { input: 'tar', output: 'tar.gz' },
    { input: 'zip', output: 'tar.gz' },
  ],

  async execute(input: ConversionInput, options?: Record<string, any>): Promise<ConversionOutput> {
    const inputFormat = input.detectedFormat.formatId;
    const targetFormat = options?.targetFormat;
    const u8 = new Uint8Array(input.buffer);
    const warnings: string[] = [];

    // 1. ZIP -> TAR
    if (inputFormat === 'zip' && targetFormat === 'tar') {
      const unzipped = fflate.unzipSync(u8);
      let totalBytes = 0;
      let count = 0;
      const tarEntries = Object.entries(unzipped).map(([rawName, data]) => {
        count++;
        totalBytes += data.length;
        checkDecompressionSafety(count, totalBytes, data.length, u8.length);
        const cleanName = sanitizeArchiveEntryPath(rawName);
        return {
          name: cleanName,
          data,
          size: data.length,
        };
      });

      const tarBytes = createTarArchive(tarEntries);
      const blob = new Blob([tarBytes.buffer as ArrayBuffer], { type: 'application/x-tar' });
      const filename = input.name.replace(/\.[^/.]+$/, '') + '.tar';

      return {
        blob,
        filename,
        mime: 'application/x-tar',
        sizeBytes: blob.size,
        warnings,
        details: { fileCount: tarEntries.length, totalUncompressedBytes: totalBytes },
      };
    }

    // 2. TAR -> ZIP
    if (inputFormat === 'tar' && targetFormat === 'zip') {
      const tarEntries = extractTarArchive(u8);
      const zipObj: Record<string, Uint8Array> = {};
      let totalBytes = 0;

      for (const entry of tarEntries) {
        totalBytes += entry.size;
        zipObj[entry.name] = entry.data;
      }

      const zipped = fflate.zipSync(zipObj, { level: 6 });
      const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
      const filename = input.name.replace(/\.[^/.]+$/, '') + '.zip';

      return {
        blob,
        filename,
        mime: 'application/zip',
        sizeBytes: blob.size,
        warnings,
        details: { fileCount: tarEntries.length, totalUncompressedBytes: totalBytes },
      };
    }

    // 3. TAR.GZ -> TAR (Decompress GZIP layer)
    if (inputFormat === 'tar.gz' && targetFormat === 'tar') {
      const decompressed = fflate.gunzipSync(u8);
      const blob = new Blob([decompressed.buffer as ArrayBuffer], { type: 'application/x-tar' });
      const filename = input.name.replace(/\.tar\.gz$/i, '.tar').replace(/\.tgz$/i, '.tar');

      return {
        blob,
        filename,
        mime: 'application/x-tar',
        sizeBytes: blob.size,
        warnings,
        details: { uncompressedSize: decompressed.length },
      };
    }

    // 4. TAR.GZ -> ZIP (Gunzip + Repack to ZIP)
    if (inputFormat === 'tar.gz' && targetFormat === 'zip') {
      const tarBytes = fflate.gunzipSync(u8);
      const tarEntries = extractTarArchive(tarBytes);
      const zipObj: Record<string, Uint8Array> = {};

      for (const entry of tarEntries) {
        zipObj[entry.name] = entry.data;
      }

      const zipped = fflate.zipSync(zipObj, { level: 6 });
      const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
      const filename = input.name.replace(/\.tar\.gz$/i, '.zip').replace(/\.tgz$/i, '.zip');

      return {
        blob,
        filename,
        mime: 'application/zip',
        sizeBytes: blob.size,
        warnings,
        details: { fileCount: tarEntries.length },
      };
    }

    // 5. TAR -> TAR.GZ (GZIP compress TAR)
    if (inputFormat === 'tar' && targetFormat === 'tar.gz') {
      const gzipped = fflate.gzipSync(u8, { level: 6 });
      const blob = new Blob([gzipped.buffer as ArrayBuffer], { type: 'application/gzip' });
      const filename = input.name.replace(/\.tar$/i, '.tar.gz');

      return {
        blob,
        filename,
        mime: 'application/gzip',
        sizeBytes: blob.size,
        warnings,
        details: { compressedSize: blob.size },
      };
    }

    // 6. GZIP -> Decompress
    if (inputFormat === 'gzip') {
      const decompressed = fflate.gunzipSync(u8);
      const blob = new Blob([decompressed.buffer as ArrayBuffer], { type: 'application/octet-stream' });
      const filename = input.name.replace(/\.gz$/i, '');

      return {
        blob,
        filename,
        mime: 'application/octet-stream',
        sizeBytes: blob.size,
        warnings,
        details: { decompressedSize: decompressed.length },
      };
    }

    throw new ConversionError(
      `Unsupported archive conversion: ${inputFormat} -> ${targetFormat}`,
      'UNSUPPORTED_ARCHIVE_CONVERSION'
    );
  },
};
