/**
 * FileFix Universal Conversion Engine - Core Type Definitions
 */

export type ConversionCategory =
  | 'archive'
  | 'data'
  | 'vector'
  | 'ebook'
  | 'image'
  | 'pdf'
  | 'subtitle'
  | 'font'
  | 'gis'
  | 'cad'
  | 'email';

export type ConversionStatus = 'supported' | 'experimental' | 'planned';

export type ConversionFidelity = 'lossless' | 'lossy' | 'structural';

export interface FileFormat {
  id: string; // e.g. 'csv', 'json', 'zip', 'svg', 'epub'
  name: string; // e.g. 'Comma-Separated Values'
  extension: string; // e.g. 'csv'
  mime: string; // e.g. 'text/csv'
  category: ConversionCategory;
  isTextBased: boolean;
  description: string;
  magicBytes?: number[][];
}

export interface ConversionOptionDefinition {
  id: string;
  label: string;
  type: 'select' | 'boolean' | 'number' | 'text';
  defaultValue: any;
  options?: Array<{ label: string; value: any }>;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface ConversionDefinition {
  id: string;
  category: ConversionCategory;
  inputFormat: string; // format id
  outputFormat: string; // format id
  inputMime: string;
  outputMime: string;
  inputExtension: string;
  outputExtension: string;
  engineId: string;
  executionMode: 'browser' | 'worker';
  status: ConversionStatus;
  fidelity: ConversionFidelity;
  preservesMetadata: boolean | 'partial';
  limitations: string[];
  maxInputBytes: number;
  optionsSchema?: ConversionOptionDefinition[];
  lossinessExplanation: string;
}

export interface DetectedFormatInfo {
  formatId: string;
  mime: string;
  extension: string;
  name: string;
  category: ConversionCategory;
  isTextBased: boolean;
  confidence: 'magic_bytes' | 'syntax_valid' | 'extension_fallback';
  meta?: Record<string, any>;
}

export interface ConversionInput {
  file: File | Blob;
  name: string;
  sizeBytes: number;
  detectedFormat: DetectedFormatInfo;
  buffer: ArrayBuffer;
}

export interface ConversionOutput {
  blob: Blob;
  filename: string;
  mime: string;
  sizeBytes: number;
  warnings: string[];
  details: Record<string, any>;
}

export interface ConversionAdapter {
  id: string;
  category: ConversionCategory;
  supportedPairs: Array<{ input: string; output: string }>;
  validateInput?: (input: ConversionInput) => Promise<void> | void;
  execute: (input: ConversionInput, options?: Record<string, any>) => Promise<ConversionOutput>;
}
