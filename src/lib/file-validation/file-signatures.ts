/**
 * FileFix Magic-Byte Content Signature Validator
 * Validates actual file headers rather than trusting extensions or client MIME types.
 */

export interface DetectedFormat {
  mime: string;
  extension: string;
  description: string;
}

export type SupportedImageFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export class FileValidationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

/**
 * Detect file format by inspecting magic bytes in ArrayBuffer or Uint8Array
 */
export function detectFormatFromHeader(input: ArrayBuffer | Uint8Array): DetectedFormat | null {
  let bytes: Uint8Array;
  if (input instanceof Uint8Array) {
    bytes = input.subarray(0, Math.min(32, input.length));
  } else {
    bytes = new Uint8Array(input, 0, Math.min(32, input.byteLength));
  }

  if (bytes.length < 4) {
    return null;
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return {
      mime: 'image/jpeg',
      extension: 'jpg',
      description: 'JPEG Image',
    };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
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
      mime: 'image/png',
      extension: 'png',
      description: 'PNG Image',
    };
  }

  // WebP: RIFF .... WEBP
  if (
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
      mime: 'image/webp',
      extension: 'webp',
      description: 'WebP Image',
    };
  }

  // GIF: GIF87a or GIF89a
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return {
      mime: 'image/gif',
      extension: 'gif',
      description: 'GIF Image',
    };
  }

  // PDF: %PDF- (25 50 44 46 2D)
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return {
      mime: 'application/pdf',
      extension: 'pdf',
      description: 'PDF Document',
    };
  }

  return null;
}

/**
 * Validates that an uploaded image file has valid magic bytes and doesn't exceed safety limits.
 */
export async function validateImageFile(
  file: File,
  maxSizeBytes: number = 50 * 1024 * 1024 // 50MB max default
): Promise<{ detected: DetectedFormat; buffer: ArrayBuffer }> {
  if (!file) {
    throw new FileValidationError('No file provided.', 'EMPTY_INPUT');
  }

  if (file.size === 0) {
    throw new FileValidationError('File is empty (0 bytes).', 'EMPTY_FILE');
  }

  if (file.size > maxSizeBytes) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const limitMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    throw new FileValidationError(
      `File size (${sizeMb} MB) exceeds safe browser processing limit (${limitMb} MB).`,
      'FILE_TOO_LARGE'
    );
  }

  // Read header (first 32 bytes)
  const headerSlice = await file.slice(0, 32).arrayBuffer();
  const detected = detectFormatFromHeader(headerSlice);

  if (!detected) {
    throw new FileValidationError(
      'Unknown or invalid file format. The file header does not match any supported image format.',
      'INVALID_MAGIC_BYTES'
    );
  }

  const validImageMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validImageMimes.includes(detected.mime)) {
    throw new FileValidationError(
      `File is not a supported image (${detected.description} detected).`,
      'UNSUPPORTED_MIME'
    );
  }

  // Read full buffer
  const buffer = await file.arrayBuffer();
  return { detected, buffer };
}
