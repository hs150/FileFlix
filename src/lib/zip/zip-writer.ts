/**
 * Zero-Dependency Client-Side ZIP Archive Packager
 * 
 * Complies with the PKWARE ZIP File Format Specification (Store method 0x0000).
 * Generates valid standard .zip archives natively in browser memory or Node test runtime
 * with zero remote dependencies, zero external network downloads, and zero vulnerability surface.
 */

export interface ZipFileInput {
  name: string;
  data: Uint8Array | ArrayBuffer;
}

// Precomputed CRC32 Lookup Table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

/**
 * Calculates standard IEEE 802.3 CRC-32 checksum.
 */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dateToDosTime(date: Date): { time: number; date: number } {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  const time = (hours << 11) | (minutes << 5) | seconds;

  const year = Math.max(0, date.getFullYear() - 1980);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const d = (year << 9) | (month << 5) | day;

  return { time, date: d };
}

/**
 * Creates a standard uncompressed ZIP archive (Store method).
 * Perfectly valid in Windows Explorer, macOS Archive Utility, Linux unzip, and 7-Zip.
 */
export function createZipArchive(files: ZipFileInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const now = new Date();
  const { time: dosTime, date: dosDate } = dateToDosTime(now);

  interface PreparedFile {
    nameBytes: Uint8Array;
    dataBytes: Uint8Array;
    crc: number;
    size: number;
    offset: number;
  }

  const prepared: PreparedFile[] = [];
  let currentOffset = 0;
  let totalDataLength = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes =
      file.data instanceof Uint8Array
        ? file.data
        : new Uint8Array(file.data);
    const checksum = crc32(dataBytes);
    const size = dataBytes.length;

    // 30 bytes fixed local header + filename length + data length
    const localHeaderSize = 30 + nameBytes.length;
    prepared.push({
      nameBytes,
      dataBytes,
      crc: checksum,
      size,
      offset: currentOffset,
    });

    currentOffset += localHeaderSize + size;
    totalDataLength += localHeaderSize + size;
  }

  const centralDirectoryOffset = currentOffset;
  let centralDirectorySize = 0;

  for (const p of prepared) {
    // 46 bytes fixed central directory header + filename length
    centralDirectorySize += 46 + p.nameBytes.length;
  }

  // 22 bytes End of Central Directory (EOCD)
  const totalZipSize = totalDataLength + centralDirectorySize + 22;
  const out = new Uint8Array(totalZipSize);
  const view = new DataView(out.buffer);

  let pos = 0;

  // 1. Write Local File Headers and Data
  for (const p of prepared) {
    // Local file header signature: 0x04034b50 ("PK\x03\x04")
    view.setUint32(pos, 0x04034b50, true);
    view.setUint16(pos + 4, 10, true); // Version needed to extract (1.0)
    view.setUint16(pos + 6, 0, true); // General purpose bit flag
    view.setUint16(pos + 8, 0, true); // Compression method (0 = Store)
    view.setUint16(pos + 10, dosTime, true); // File last mod time
    view.setUint16(pos + 12, dosDate, true); // File last mod date
    view.setUint32(pos + 14, p.crc, true); // CRC-32
    view.setUint32(pos + 18, p.size, true); // Compressed size
    view.setUint32(pos + 22, p.size, true); // Uncompressed size
    view.setUint16(pos + 26, p.nameBytes.length, true); // File name length
    view.setUint16(pos + 28, 0, true); // Extra field length
    pos += 30;

    out.set(p.nameBytes, pos);
    pos += p.nameBytes.length;

    out.set(p.dataBytes, pos);
    pos += p.dataBytes.length;
  }

  // 2. Write Central Directory Headers
  for (const p of prepared) {
    // Central directory header signature: 0x02014b50 ("PK\x01\x02")
    view.setUint32(pos, 0x02014b50, true);
    view.setUint16(pos + 4, 20, true); // Version made by (2.0)
    view.setUint16(pos + 6, 10, true); // Version needed to extract (1.0)
    view.setUint16(pos + 8, 0, true); // General purpose bit flag
    view.setUint16(pos + 10, 0, true); // Compression method (0 = Store)
    view.setUint16(pos + 12, dosTime, true); // File last mod time
    view.setUint16(pos + 14, dosDate, true); // File last mod date
    view.setUint32(pos + 16, p.crc, true); // CRC-32
    view.setUint32(pos + 20, p.size, true); // Compressed size
    view.setUint32(pos + 24, p.size, true); // Uncompressed size
    view.setUint16(pos + 28, p.nameBytes.length, true); // File name length
    view.setUint16(pos + 30, 0, true); // Extra field length
    view.setUint16(pos + 32, 0, true); // File comment length
    view.setUint16(pos + 34, 0, true); // Disk number start
    view.setUint16(pos + 36, 0, true); // Internal file attributes
    view.setUint32(pos + 38, 0, true); // External file attributes
    view.setUint32(pos + 42, p.offset, true); // Relative offset of local header
    pos += 46;

    out.set(p.nameBytes, pos);
    pos += p.nameBytes.length;
  }

  // 3. Write End of Central Directory Record (EOCD)
  // EOCD signature: 0x06054b50 ("PK\x05\x06")
  view.setUint32(pos, 0x06054b50, true);
  view.setUint16(pos + 4, 0, true); // Number of this disk
  view.setUint16(pos + 6, 0, true); // Disk where central directory starts
  view.setUint16(pos + 8, prepared.length, true); // Records on this disk
  view.setUint16(pos + 10, prepared.length, true); // Total records
  view.setUint32(pos + 12, centralDirectorySize, true); // Size of central directory
  view.setUint32(pos + 16, centralDirectoryOffset, true); // Offset of start of central directory
  view.setUint16(pos + 20, 0, true); // Comment length

  return out;
}

/**
 * Convenience helper returning a standard application/zip Blob.
 */
export function createZipBlob(files: ZipFileInput[]): Blob {
  const bytes = createZipArchive(files);
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' });
}
