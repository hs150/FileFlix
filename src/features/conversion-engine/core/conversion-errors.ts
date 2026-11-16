/**
 * FileFix Universal Conversion Engine - Error Hierarchy
 */

export class ConversionError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: Record<string, any>) {
    super(message);
    this.name = 'ConversionError';
  }
}

export class SecurityValidationError extends ConversionError {
  constructor(message: string, code: string = 'SECURITY_VIOLATION', details?: Record<string, any>) {
    super(message, code, details);
    this.name = 'SecurityValidationError';
  }
}

export class FormatMismatchError extends ConversionError {
  constructor(message: string, code: string = 'FORMAT_MISMATCH', details?: Record<string, any>) {
    super(message, code, details);
    this.name = 'FormatMismatchError';
  }
}

export class ResourceLimitError extends ConversionError {
  constructor(message: string, code: string = 'RESOURCE_LIMIT_EXCEEDED', details?: Record<string, any>) {
    super(message, code, details);
    this.name = 'ResourceLimitError';
  }
}

export class UnsupportedConversionError extends ConversionError {
  constructor(inputFormat: string, outputFormat: string) {
    super(
      `Conversion from format "${inputFormat}" to "${outputFormat}" is not currently supported locally in FileFix.`,
      'UNSUPPORTED_CONVERSION',
      { inputFormat, outputFormat }
    );
    this.name = 'UnsupportedConversionError';
  }
}
