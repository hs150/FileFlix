/**
 * FileFix Multi-Format Conversion System - Type Definitions
 */

export type ConversionVerificationStatus = 'VERIFIED_LOCAL' | 'PLANNED' | 'UNSUPPORTED';

export type FileCategory = 'image' | 'pdf' | 'document' | 'media';

export interface ConversionDefinition {
  id: string;
  name: string;
  description: string;
  category: FileCategory;
  inputMime: string;
  outputMime: string;
  inputExtension: string;
  outputExtension: string;
  engine: string;
  isBrowserLocal: boolean;
  preservesLossless: boolean;
  preservesTransparency: boolean;
  preservesAnimation: boolean;
  maxTestedSizeBytes: number;
  knownLimitations: string[];
  verificationStatus: ConversionVerificationStatus;
  lossinessExplanation: string;
}

export interface ImageConversionOptions {
  targetFormat: 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: number; // 0.0 to 1.0 (for lossy formats)
  backgroundColor?: string; // hex code for flattening transparent pixels (default '#ffffff')
}

export type PageSizeOption = 'a4' | 'letter' | 'fit-image';
export type PageOrientationOption = 'portrait' | 'landscape' | 'auto';
export type PageMarginOption = 'none' | 'small' | 'normal';

export interface ImageToPdfOptions {
  pageSize: PageSizeOption;
  orientation: PageOrientationOption;
  margin: PageMarginOption;
  title?: string;
}

export interface PdfToImageOptions {
  targetFormat: 'image/jpeg' | 'image/png';
  scale: 1 | 2; // 1x = 72/96 DPI, 2x = 150/192 DPI high resolution
  quality?: number; // for jpeg
  pages?: number[]; // 1-based page indices (omitted = all pages)
}

export interface ConvertedPageResult {
  pageNumber: number;
  blob: Blob;
  url: string;
  filename: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface ConversionResult {
  outputBlob: Blob;
  outputUrl: string;
  outputFilename: string;
  outputMime: string;
  outputSizeBytes: number;
  inputSizeBytes: number;
  processingTimeMs: number;
  details: {
    width?: number;
    height?: number;
    pageCount?: number;
    pages?: ConvertedPageResult[];
    zipBlob?: Blob;
    zipUrl?: string;
  };
  warnings: string[];
}
