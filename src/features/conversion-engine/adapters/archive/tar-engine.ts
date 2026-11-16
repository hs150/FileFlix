import { sanitizeArchiveEntryPath, checkDecompressionSafety } from './security-guards';

export interface TarEntry {
  name: string;
  data: Uint8Array;
  size: number;
  mtime?: number;
}

/**
 * Creates a standard POSIX ustar TAR archive from a list of files.
 */
export function createTarArchive(entries: TarEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const blocks: Uint8Array[] = [];

  for (const entry of entries) {
    const cleanPath = sanitizeArchiveEntryPath(entry.name);
    const data = entry.data;
    const size = data.length;
    const mtime = Math.floor((entry.mtime || Date.now()) / 1000);

    // 512-byte header block
    const header = new Uint8Array(512);

    // 0..99: File Name
    const nameBytes = encoder.encode(cleanPath);
    header.set(nameBytes.subarray(0, 100), 0);

    // 100..107: File Mode (0000644\0)
    writeOctal(header, 100, 7, 0o644);

    // 108..115: UID (0000000\0)
    writeOctal(header, 108, 7, 0);

    // 116..123: GID (0000000\0)
    writeOctal(header, 116, 7, 0);

    // 124..135: File Size (11 octal digits + space)
    writeOctal(header, 124, 11, size);

    // 136..147: Modification Time
    writeOctal(header, 136, 11, mtime);

    // 156: Type Flag ('0' = normal file)
    header[156] = 0x30;

    // 257..262: Magic 'ustar\0'
    header.set([0x75, 0x73, 0x74, 0x61, 0x72, 0x00], 257);
    // 263..264: Version '00'
    header.set([0x30, 0x30], 263);

    // Calculate Checksum (148..155)
    // Initially treat checksum bytes as ASCII spaces (0x20)
    for (let i = 148; i < 156; i++) header[i] = 0x20;
    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += header[i];
    writeOctal(header, 148, 6, checksum);
    header[154] = 0x00;
    header[155] = 0x20;

    blocks.push(header);

    // File Data Block(s)
    if (size > 0) {
      blocks.push(data);
      // Pad to 512-byte boundary
      const remainder = size % 512;
      if (remainder > 0) {
        blocks.push(new Uint8Array(512 - remainder));
      }
    }
  }

  // End of archive marker: two 512-byte zero blocks
  blocks.push(new Uint8Array(1024));

  // Combine all blocks into a single Uint8Array
  const totalLength = blocks.reduce((acc, b) => acc + b.length, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const block of blocks) {
    out.set(block, offset);
    offset += block.length;
  }

  return out;
}

/**
 * Extracts entries from a POSIX ustar TAR archive.
 */
export function extractTarArchive(tarBuffer: ArrayBuffer | Uint8Array): TarEntry[] {
  const bytes = tarBuffer instanceof Uint8Array ? tarBuffer : new Uint8Array(tarBuffer);
  const entries: TarEntry[] = [];
  const decoder = new TextDecoder('utf-8');

  let offset = 0;
  let totalExtractedBytes = 0;

  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);

    // Check for null block (end of archive)
    const isZero = header.every((b) => b === 0);
    if (isZero) break;

    // Read filename (0..99)
    let nullIdx = 0;
    while (nullIdx < 100 && header[nullIdx] !== 0) nullIdx++;
    const rawName = decoder.decode(header.subarray(0, nullIdx)).trim();

    if (!rawName) {
      offset += 512;
      continue;
    }

    const cleanPath = sanitizeArchiveEntryPath(rawName);

    // Read size (124..135, octal)
    const sizeStr = decoder.decode(header.subarray(124, 136)).trim().replace(/\0/g, '');
    const size = parseInt(sizeStr, 8) || 0;

    // Read typeflag (156)
    const typeflag = header[156];
    // Reject symlinks (typeflag '2' = 0x32)
    if (typeflag === 0x32) {
      throw new Error(`Archive entry "${cleanPath}" is a symbolic link, which is disallowed for security.`);
    }

    // Advance offset past header
    offset += 512;

    // Safety checks
    totalExtractedBytes += size;
    checkDecompressionSafety(entries.length + 1, totalExtractedBytes, size, bytes.length);

    // Extract file data if normal file ('0' or 0)
    let data = new Uint8Array(0);
    if (size > 0 && offset + size <= bytes.length) {
      data = bytes.slice(offset, offset + size);
    }

    // Skip to next 512-byte boundary
    const remainder = size % 512;
    const padding = remainder > 0 ? 512 - remainder : 0;
    offset += size + padding;

    // Skip pure directory entries (typeflag '5' = 0x35 or ends with /)
    if (typeflag !== 0x35 && !cleanPath.endsWith('/')) {
      entries.push({
        name: cleanPath,
        data,
        size,
      });
    }
  }

  return entries;
}

function writeOctal(buf: Uint8Array, offset: number, length: number, val: number): void {
  const str = val.toString(8).padStart(length - 1, '0') + '\0';
  for (let i = 0; i < length && i < str.length; i++) {
    buf[offset + i] = str.charCodeAt(i);
  }
}
