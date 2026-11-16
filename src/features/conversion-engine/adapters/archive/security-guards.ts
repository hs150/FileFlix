import { SecurityValidationError, ResourceLimitError } from '../../core/conversion-errors';

export interface ArchiveSecurityLimits {
  maxEntries: number;
  maxTotalBytes: number;
  maxSingleFileBytes: number;
  maxCompressionRatio: number;
}

export const DEFAULT_ARCHIVE_LIMITS: ArchiveSecurityLimits = {
  maxEntries: 1000,
  maxTotalBytes: 100 * 1024 * 1024, // 100 MB
  maxSingleFileBytes: 50 * 1024 * 1024, // 50 MB
  maxCompressionRatio: 100, // 100:1 bomb protection
};

const WINDOWS_RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;

/**
 * Validates and sanitizes an archive entry filename/path.
 * Protects against Zip Slip (path traversal), absolute paths, and reserved device names.
 */
export function sanitizeArchiveEntryPath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') {
    throw new SecurityValidationError('Archive entry has missing or invalid filename.');
  }

  // Reject null bytes
  if (rawPath.includes('\0')) {
    throw new SecurityValidationError('Archive entry contains forbidden null byte characters.');
  }

  // Normalize backslashes to forward slashes
  let normalized = rawPath.replace(/\\/g, '/');

  // Reject absolute paths
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    throw new SecurityValidationError(
      `Archive entry "${rawPath}" contains an unsafe absolute path.`,
      'ZIP_SLIP_ABSOLUTE_PATH'
    );
  }

  // Reject path traversal ../
  const segments = normalized.split('/');
  for (const seg of segments) {
    if (seg === '..') {
      throw new SecurityValidationError(
        `Archive entry "${rawPath}" contains forbidden "../" directory traversal.`,
        'ZIP_SLIP_TRAVERSAL'
      );
    }
    if (WINDOWS_RESERVED_NAMES.test(seg)) {
      throw new SecurityValidationError(
        `Archive entry "${rawPath}" contains reserved OS device name "${seg}".`,
        'RESERVED_NAME_VIOLATION'
      );
    }
  }

  // Remove leading './' or '/'
  normalized = normalized.replace(/^(\.\/)+/, '').replace(/^\/+/, '');

  if (!normalized) {
    throw new SecurityValidationError('Archive entry resolves to empty path after sanitization.');
  }

  return normalized;
}

/**
 * Validates archive decompression metrics against security bounds.
 */
export function checkDecompressionSafety(
  currentEntries: number,
  totalBytes: number,
  entryBytes: number,
  compressedBytes: number,
  limits: ArchiveSecurityLimits = DEFAULT_ARCHIVE_LIMITS
): void {
  if (currentEntries > limits.maxEntries) {
    throw new ResourceLimitError(
      `Archive exceeds maximum allowed entry count (${limits.maxEntries} files).`,
      'MAX_ENTRIES_EXCEEDED'
    );
  }

  if (entryBytes > limits.maxSingleFileBytes) {
    throw new ResourceLimitError(
      `Single archive file exceeds maximum allowed size (${limits.maxSingleFileBytes / (1024 * 1024)} MB).`,
      'SINGLE_ENTRY_TOO_LARGE'
    );
  }

  if (totalBytes > limits.maxTotalBytes) {
    throw new ResourceLimitError(
      `Total uncompressed archive exceeds maximum allowed size (${limits.maxTotalBytes / (1024 * 1024)} MB).`,
      'TOTAL_EXPANDED_TOO_LARGE'
    );
  }

  if (compressedBytes > 0) {
    const ratio = totalBytes / compressedBytes;
    if (ratio > limits.maxCompressionRatio) {
      throw new SecurityValidationError(
        `Archive exhibits an extreme compression ratio (${ratio.toFixed(0)}:1) characteristic of a decompression bomb.`,
        'DECOMPRESSION_BOMB_DETECTED'
      );
    }
  }
}
