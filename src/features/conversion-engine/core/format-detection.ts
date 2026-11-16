import { DetectedFormatInfo } from './conversion-types';
import * as fflate from 'fflate';

/**
 * Universal Format Detector
 * Combines magic-byte signatures, container inspection, and text syntax validation.
 * Never trusts filename extensions alone.
 */
export async function detectFileFormat(
  buffer: ArrayBuffer,
  filenameHint: string = ''
): Promise<DetectedFormatInfo | null> {
  const bytes = new Uint8Array(buffer, 0, Math.min(4096, buffer.byteLength));
  const ext = filenameHint.toLowerCase().split('.').pop() || '';

  // 1. Binary Magic-Byte Detection

  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return {
      formatId: 'jpeg',
      name: 'JPEG Image',
      extension: 'jpg',
      mime: 'image/jpeg',
      category: 'image',
      isTextBased: false,
      confidence: 'magic_bytes',
    };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return {
      formatId: 'png',
      name: 'PNG Image',
      extension: 'png',
      mime: 'image/png',
      category: 'image',
      isTextBased: false,
      confidence: 'magic_bytes',
    };
  }

  // WebP: RIFF .... WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return {
      formatId: 'webp',
      name: 'WebP Image',
      extension: 'webp',
      mime: 'image/webp',
      category: 'image',
      isTextBased: false,
      confidence: 'magic_bytes',
    };
  }

  // ICO: 00 00 01 00
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return {
      formatId: 'ico',
      name: 'Windows Icon',
      extension: 'ico',
      mime: 'image/x-icon',
      category: 'vector',
      isTextBased: false,
      confidence: 'magic_bytes',
    };
  }

  // PDF: %PDF- (25 50 44 46 2D)
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return {
      formatId: 'pdf',
      name: 'PDF Document',
      extension: 'pdf',
      mime: 'application/pdf',
      category: 'pdf',
      isTextBased: false,
      confidence: 'magic_bytes',
    };
  }

  // GZIP: 1F 8B
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    // Check if it's a tar.gz / tgz archive
    if (ext === 'tgz' || filenameHint.toLowerCase().endsWith('.tar.gz')) {
      return {
        formatId: 'tar.gz',
        name: 'TAR GZ Compressed Archive',
        extension: 'tar.gz',
        mime: 'application/gzip',
        category: 'archive',
        isTextBased: false,
        confidence: 'magic_bytes',
      };
    }
    return {
      formatId: 'gzip',
      name: 'GZIP Compressed File',
      extension: 'gz',
      mime: 'application/gzip',
      category: 'archive',
      isTextBased: false,
      confidence: 'magic_bytes',
    };
  }

  // TAR: POSIX ustar at offset 257 (75 73 74 61 72)
  if (bytes.length >= 262) {
    const ustar = String.fromCharCode(...bytes.subarray(257, 262));
    if (ustar === 'ustar') {
      return {
        formatId: 'tar',
        name: 'TAR Tape Archive',
        extension: 'tar',
        mime: 'application/x-tar',
        category: 'archive',
        isTextBased: false,
        confidence: 'magic_bytes',
      };
    }
  }

  // ZIP-Based Container: 50 4B 03 04 ("PK\x03\x04")
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    // Inspect internal container structure
    try {
      const fullU8 = new Uint8Array(buffer);
      const decompressed = fflate.unzipSync(fullU8, {
        filter(file) {
          // Only check entry names to classify container
          return (
            file.name === 'mimetype' ||
            file.name === 'META-INF/container.xml' ||
            file.name.startsWith('xl/') ||
            file.name === '[Content_Types].xml'
          );
        },
      });

      const entryNames = Object.keys(decompressed);

      // EPUB Check: has mimetype with 'application/epub+zip' or META-INF/container.xml
      if (entryNames.includes('META-INF/container.xml') || (decompressed['mimetype'] && new TextDecoder().decode(decompressed['mimetype']).trim() === 'application/epub+zip')) {
        return {
          formatId: 'epub',
          name: 'EPUB Electronic Publication',
          extension: 'epub',
          mime: 'application/epub+zip',
          category: 'ebook',
          isTextBased: false,
          confidence: 'magic_bytes',
        };
      }

      // XLSX Check: has xl/ directory or workbook.xml
      if (entryNames.some((n) => n.startsWith('xl/')) || (entryNames.includes('[Content_Types].xml') && ext === 'xlsx')) {
        return {
          formatId: 'xlsx',
          name: 'Microsoft Excel Spreadsheet',
          extension: 'xlsx',
          mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          category: 'data',
          isTextBased: false,
          confidence: 'magic_bytes',
        };
      }

      // CBZ Check: extension is cbz
      if (ext === 'cbz') {
        return {
          formatId: 'cbz',
          name: 'Comic Book ZIP Archive',
          extension: 'cbz',
          mime: 'application/vnd.comicbook+zip',
          category: 'ebook',
          isTextBased: false,
          confidence: 'magic_bytes',
        };
      }

      return {
        formatId: 'zip',
        name: 'ZIP Archive',
        extension: 'zip',
        mime: 'application/zip',
        category: 'archive',
        isTextBased: false,
        confidence: 'magic_bytes',
      };
    } catch {
      // Fallback if full unzip fails on partial read
      if (ext === 'epub') {
        return {
          formatId: 'epub',
          name: 'EPUB Electronic Publication',
          extension: 'epub',
          mime: 'application/epub+zip',
          category: 'ebook',
          isTextBased: false,
          confidence: 'magic_bytes',
        };
      }
      if (ext === 'xlsx') {
        return {
          formatId: 'xlsx',
          name: 'Microsoft Excel Spreadsheet',
          extension: 'xlsx',
          mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          category: 'data',
          isTextBased: false,
          confidence: 'magic_bytes',
        };
      }
      return {
        formatId: 'zip',
        name: 'ZIP Archive',
        extension: 'zip',
        mime: 'application/zip',
        category: 'archive',
        isTextBased: false,
        confidence: 'magic_bytes',
      };
    }
  }

  // 2. Text-Based Syntax Detection
  try {
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const textSample = textDecoder.decode(bytes).trim();

    // Check SVG: XML containing <svg
    if (textSample.includes('<svg') && (textSample.startsWith('<?xml') || textSample.startsWith('<svg') || textSample.includes('xmlns="http://www.w3.org/2000/svg"'))) {
      return {
        formatId: 'svg',
        name: 'Scalable Vector Graphics',
        extension: 'svg',
        mime: 'image/svg+xml',
        category: 'vector',
        isTextBased: true,
        confidence: 'syntax_valid',
      };
    }

    // Check HTML
    if (textSample.toLowerCase().includes('<!doctype html') || textSample.toLowerCase().includes('<html') || (textSample.includes('<body') && ext === 'html')) {
      return {
        formatId: 'html',
        name: 'HTML Document',
        extension: 'html',
        mime: 'text/html',
        category: 'ebook',
        isTextBased: true,
        confidence: 'syntax_valid',
      };
    }

    // Check XML
    if (textSample.startsWith('<?xml') || (textSample.startsWith('<') && textSample.endsWith('>') && ext === 'xml')) {
      return {
        formatId: 'xml',
        name: 'XML Document',
        extension: 'xml',
        mime: 'application/xml',
        category: 'data',
        isTextBased: true,
        confidence: 'syntax_valid',
      };
    }

    // Check JSON
    if ((textSample.startsWith('{') && textSample.endsWith('}')) || (textSample.startsWith('[') && textSample.endsWith(']'))) {
      try {
        JSON.parse(textSample);
        return {
          formatId: 'json',
          name: 'JSON Data',
          extension: 'json',
          mime: 'application/json',
          category: 'data',
          isTextBased: true,
          confidence: 'syntax_valid',
        };
      } catch {
        // May be incomplete sample or malformed JSON
      }
    }

    // Check JSONL (NDJSON)
    if (ext === 'jsonl' || ext === 'ndjson') {
      const lines = textSample.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        let allJson = true;
        for (const line of lines.slice(0, 5)) {
          try {
            JSON.parse(line);
          } catch {
            allJson = false;
            break;
          }
        }
        if (allJson) {
          return {
            formatId: 'jsonl',
            name: 'JSON Lines (NDJSON)',
            extension: 'jsonl',
            mime: 'application/x-ndjson',
            category: 'data',
            isTextBased: true,
            confidence: 'syntax_valid',
          };
        }
      }
    }

    // Check YAML
    if (ext === 'yaml' || ext === 'yml') {
      return {
        formatId: 'yaml',
        name: 'YAML Data',
        extension: 'yaml',
        mime: 'application/x-yaml',
        category: 'data',
        isTextBased: true,
        confidence: 'syntax_valid',
      };
    }

    // Check TSV (contains tabs)
    if (ext === 'tsv' || (textSample.includes('\t') && textSample.includes('\n'))) {
      return {
        formatId: 'tsv',
        name: 'Tab-Separated Values',
        extension: 'tsv',
        mime: 'text/tab-separated-values',
        category: 'data',
        isTextBased: true,
        confidence: 'syntax_valid',
      };
    }

    // Check CSV (comma separated with newlines)
    if (ext === 'csv' || (textSample.includes(',') && textSample.includes('\n'))) {
      return {
        formatId: 'csv',
        name: 'Comma-Separated Values',
        extension: 'csv',
        mime: 'text/csv',
        category: 'data',
        isTextBased: true,
        confidence: 'syntax_valid',
      };
    }

    // Plain TXT
    if (ext === 'txt' || ext === 'text') {
      return {
        formatId: 'txt',
        name: 'Plain Text',
        extension: 'txt',
        mime: 'text/plain',
        category: 'data',
        isTextBased: true,
        confidence: 'syntax_valid',
      };
    }
  } catch {
    // Non-text binary
  }

  // 3. Fallback based on extension if known
  if (ext === 'tar') {
    return {
      formatId: 'tar',
      name: 'TAR Tape Archive',
      extension: 'tar',
      mime: 'application/x-tar',
      category: 'archive',
      isTextBased: false,
      confidence: 'extension_fallback',
    };
  }

  return null;
}
