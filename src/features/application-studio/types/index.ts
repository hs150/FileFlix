import { SupportedOutputFormat } from '../../image-studio/types';

export type PresetCategory = 'photo' | 'signature' | 'custom';
export type PresetMode = 'transform' | 'checker-only';
export type FittingMode = 'center-crop' | 'pad-white';

export interface FileSizeBounds {
  isSpecified: boolean;
  minBytes?: number;
  maxBytes?: number;
  officialDescription: string;
}

export interface PixelDimensionBounds {
  isSpecified: boolean;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  exactWidth?: number;
  exactHeight?: number;
  officialDescription: string;
}

export interface PhysicalDimensions {
  isSpecified: boolean;
  widthMm?: number;
  heightMm?: number;
  widthCm?: number;
  heightCm?: number;
  faceHeightMinMm?: number;
  faceHeightMaxMm?: number;
  officialDescription: string;
}

export interface AspectRatioSpecification {
  isSpecified: boolean;
  width?: number;
  height?: number;
  description: string;
}

export interface FaceOccupancySpecification {
  isSpecified: boolean;
  minPercent?: number;
  maxPercent?: number;
  description: string;
}

export interface ApplicationPreset {
  id: string;
  displayName: string;
  shortName: string;
  country: string;
  issuingAuthority: string;
  applicationName: string; // Exact form / exam name
  category: PresetCategory;
  mode: PresetMode; // 'transform' or 'checker-only'

  // Input & Output Formats
  allowedInputFormats: string[]; // MIME types
  allowedOutputFormats: SupportedOutputFormat[];
  recommendedOutputFormat: SupportedOutputFormat;

  // Actual Official Requirements
  fileSize: FileSizeBounds;
  pixelDimensions: PixelDimensionBounds;
  physicalDimensions?: PhysicalDimensions;
  aspectRatio: AspectRatioSpecification;
  faceOccupancy?: FaceOccupancySpecification;

  // Policy & Integrity
  softwareTransformationPermitted: boolean;
  requiresOriginalUnedited: boolean;
  isExamSpecificOrVolatile: boolean;

  // Provenance & Metadata
  officialSourceUrl: string;
  sourcePublicationDate?: string;
  verificationDate: string; // YYYY-MM-DD
  scopeAndLimitations: string;
  warningNotice?: string;

  // FileFix Recommendations (distinct from official rules)
  defaultFittingMode: FittingMode;
  defaultTargetKb?: number;
  fileFixRecommendations: string[];
}

export type CheckStatus =
  | 'TECHNICAL_PASS'
  | 'TECHNICAL_FAIL'
  | 'NOT_SPECIFIED'
  | 'UNVERIFIED_VISUAL';

export interface ComplianceCheckItem {
  id: string;
  name: string;
  status: CheckStatus;
  statusLabel: string; // "Technical check passed", "Technical check failed", "Official requirement not specified", "Visual requirement not automatically verified"
  actual: string;
  expected: string;
  isOfficialRequirement: boolean;
  notes?: string;
}

export type OverallComplianceVerdict =
  | 'TECHNICAL_CHECKS_PASSED'
  | 'TECHNICAL_CHECKS_FAILED'
  | 'CHECKER_ONLY_MODE';

export interface ComplianceReport {
  overallVerdict: OverallComplianceVerdict;
  verdictTitle: string;
  verdictDescription: string;
  items: ComplianceCheckItem[];
  unverifiedVisualNotice: string;
  uneditedPhotoWarning?: string;
  reVerificationNotice?: string;
  fileFixRecommendations: string[];
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
