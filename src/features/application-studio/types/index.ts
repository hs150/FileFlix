import { SupportedOutputFormat } from '../../image-studio/types';

export type PresetCategory = 'photo' | 'signature' | 'custom';

export type FittingMode = 'center-crop' | 'pad-white';

export interface ApplicationPreset {
  id: string;
  name: string;
  shortName: string;
  category: PresetCategory;
  issuingAuthority: string;
  applicationType: string;
  officialSourceUrl: string;
  verificationDate: string; // ISO date format YYYY-MM-DD
  
  // Dimensions
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  exactWidth?: number;
  exactHeight?: number;
  aspectRatio: {
    width: number;
    height: number;
    description: string;
  };

  // File size boundaries in bytes
  minBytes: number;
  maxBytes: number;
  minKbDescription: string;
  maxKbDescription: string;

  // Formats
  allowedFormats: SupportedOutputFormat[];
  recommendedFormat: SupportedOutputFormat;

  // Guidance & Limitations
  constraints: string[];
  warnings: string[];
  portalCaptureNotes?: string;
  requiresUneditedOriginal: boolean;

  // Defaults
  defaultFittingMode: FittingMode;
  defaultTargetKb?: number;
}

export interface ComplianceCheckItem {
  name: string;
  passed: boolean;
  actual: string;
  expected: string;
  critical: boolean;
}

export interface ComplianceReport {
  isTechnicallyCompliant: boolean;
  items: ComplianceCheckItem[];
  biometricDisclaimer: string;
  authorityNotice: string;
}

export interface ApplicationProcessingOptions {
  sourceBlob: Blob;
  preset: ApplicationPreset;
  fittingMode: FittingMode;
  customWidth?: number;
  customHeight?: number;
  targetSizeKb?: number;
  allowDimensionReductionForTarget?: boolean;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
}
