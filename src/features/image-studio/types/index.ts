export type SupportedOutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImageMetadata {
  width: number;
  height: number;
  sizeBytes: number;
  format: string;
  name: string;
  aspectRatio: number;
  objectUrl: string;
}

export interface ResizeSettings {
  enabled: boolean;
  width: number;
  height: number;
  maintainAspectRatio: boolean;
}

export interface CropSettings {
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompressionSettings {
  format: SupportedOutputFormat;
  quality: number; // 0.05 to 1.0
  targetSizeKb: number | null; // e.g. 50 (KB)
  allowDimensionReductionForTarget: boolean;
}

export interface ProcessingState {
  status: 'idle' | 'validating' | 'decoding' | 'processing' | 'optimizing' | 'success' | 'error';
  progressMessage: string;
  error: string | null;
}

export interface ProcessingResult {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
  format: SupportedOutputFormat;
  processingTimeMs: number;
  targetSizeAchieved?: boolean;
  targetSizeExplanation?: string;
}
