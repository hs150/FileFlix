import {
  ApplicationPreset,
  ComplianceReport,
  ComplianceCheckItem,
  OverallComplianceVerdict,
} from '../types';

export const APPLICATION_PRESETS_VERSION = '2.0.0';

export const APPLICATION_PRESETS: ApplicationPreset[] = [
  {
    id: 'us-visa-ds160',
    displayName: 'U.S. Visa (Form DS-160) — Digital Photo',
    shortName: 'U.S. Visa (DS-160)',
    country: 'United States',
    issuingAuthority: 'U.S. Department of State — Consular Electronic Application Center (CEAC)',
    applicationName: 'Nonimmigrant Visa (DS-160) & Immigrant Visa Online Application',
    category: 'photo',
    mode: 'transform',
    allowedInputFormats: ['image/jpeg', 'image/jpg'],
    allowedOutputFormats: ['image/jpeg'],
    recommendedOutputFormat: 'image/jpeg',
    fileSize: {
      isSpecified: true,
      minBytes: 1024, // 1 KB practical lower bound (official rule specifies <= 240 KB with no lower bound)
      maxBytes: 245760, // 240 KB exact official ceiling (240 * 1024)
      officialDescription: 'Equal to or less than 240 KB (no minimum file size specified)',
    },
    pixelDimensions: {
      isSpecified: true,
      minWidth: 600,
      maxWidth: 1200,
      minHeight: 600,
      maxHeight: 1200,
      exactWidth: 600,
      exactHeight: 600,
      officialDescription: 'Square: minimum 600 × 600 pixels, maximum 1200 × 1200 pixels',
    },
    physicalDimensions: {
      isSpecified: true,
      widthMm: 51,
      heightMm: 51,
      faceHeightMinMm: 25,
      faceHeightMaxMm: 35,
      officialDescription: '2 × 2 inches (51 × 51 mm); head height between 1 inch and 1 3/8 inches (25–35 mm)',
    },
    aspectRatio: {
      isSpecified: true,
      width: 1,
      height: 1,
      description: '1:1 Exact Square (width === height, zero tolerance)',
      exactSquareRequired: true,
      tolerance: 0,
    },
    faceOccupancy: {
      isSpecified: true,
      minPercent: 50,
      maxPercent: 69,
      description: 'Head height must occupy between 50% and 69% of the total image height',
    },
    softwareTransformationPermitted: true,
    requiresOriginalUnedited: true,
    isExamSpecificOrVolatile: false,
    officialSourceUrl:
      'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos/digital-image-requirements.html',
    sourcePublicationDate: '2026-01-01',
    verificationDate: '2026-11-16',
    scopeAndLimitations:
      'Official requirements specify: square aspect ratio, 600–1200 px, JPEG, sRGB color space, maximum 240 KB, and compression ratio equal to or less than 20:1. The photograph must be an original, unedited photo taken within the last 6 months. Retouched, digitally altered, filtered, or AI-enhanced photos are strictly rejected.',
    warningNotice:
      'The Department of State prohibits digitally altered photographs. Technical dimension and size compliance does NOT guarantee consular biometric acceptance.',
    defaultFittingMode: 'center-crop',
    defaultTargetKb: 200,
    fileFixRecommendations: [
      'FileFix can center-crop and compress to 600×600 px and <=240 KB.',
      'Ensure the original photo was taken against a plain white or off-white background with a neutral expression.',
      'Do not use beauty filters, background replacement tools, or retouching.',
    ],
  },
  {
    id: 'us-passport-renewal',
    displayName: 'U.S. Passport Online Renewal (OPR) — Photo Checker',
    shortName: 'U.S. Passport Renewal',
    country: 'United States',
    issuingAuthority: 'U.S. Department of State — Bureau of Consular Affairs',
    applicationName: 'Online Passport Renewal (OPR) Digital Photo Upload',
    category: 'photo',
    mode: 'checker-only', // Explicitly checker/instruction mode per government rules!
    allowedInputFormats: ['image/jpeg', 'image/jpg', 'image/png'],
    allowedOutputFormats: ['image/jpeg', 'image/png'],
    recommendedOutputFormat: 'image/jpeg',
    fileSize: {
      isSpecified: true,
      minBytes: 55296, // 54 KB exact official minimum (54 * 1024)
      maxBytes: 10485760, // 10 MB exact official maximum (10 * 1024 * 1024)
      officialDescription: 'Between 54 KB and 10 MB (strict official floor and ceiling)',
    },
    pixelDimensions: {
      isSpecified: false,
      officialDescription: 'Official requirement not specified in online renewal guidance (portal tool crops and resizes)',
    },
    aspectRatio: {
      isSpecified: false,
      description: 'Not required prior to upload (official government portal tool performs cropping)',
    },
    physicalDimensions: {
      isSpecified: true,
      widthMm: 51,
      heightMm: 51,
      officialDescription: '2 × 2 inches (51 × 51 mm)',
    },
    faceOccupancy: {
      isSpecified: true,
      minPercent: 50,
      maxPercent: 69,
      description: 'Head must be 1 to 1 3/8 inches (50% to 69% of image height)',
    },
    softwareTransformationPermitted: false, // Government explicitly warns against digitally edited photos!
    requiresOriginalUnedited: true,
    isExamSpecificOrVolatile: false,
    officialSourceUrl:
      'https://travel.state.gov/en/passports/renew-replace/online/upload-digital-photo.html',
    sourcePublicationDate: '2026-01-01',
    verificationDate: '2026-11-16',
    scopeAndLimitations:
      'Government rules require an original, unedited photo between 54 KB and 10 MB in JPG, JPEG, PNG, HEIC, or HEIF format. The official passport application provides its own built-in cropping and repositioning tool. The government explicitly warns against digitally altered, software-edited, or filtered photos.',
    warningNotice:
      'INSTRUCTION & REQUIREMENTS CHECKER MODE: Do not edit or transform your photograph in FileFix for passport renewal. The U.S. government provides its own cropping tool and strictly prohibits third-party software alterations. FileFix verifies your existing file without altering it.',
    defaultFittingMode: 'center-crop',
    defaultTargetKb: 500,
    fileFixRecommendations: [
      'Take an unedited original photo in natural lighting against a plain white background.',
      'Verify that your file size is between 54 KB and 10 MB and resolution is at least 600×600 px.',
      'Upload the unedited original photo directly to the official government renewal portal and use the government portal tool for final cropping.',
    ],
  },
  {
    id: 'france-schengen-visa',
    displayName: 'France / Schengen Visa — Physical & Digital Guidance',
    shortName: 'France / Schengen Visa',
    country: 'France / Schengen Area',
    issuingAuthority: "France-Visas / Ministère de l'Intérieur (ICAO Doc 9303 Compliant)",
    applicationName: 'France-Visas Online Portal & Consular Visa Application',
    category: 'photo',
    mode: 'checker-only', // Switched to checker/instruction mode per official physical-only guidance
    allowedInputFormats: ['image/jpeg', 'image/jpg'],
    allowedOutputFormats: ['image/jpeg'],
    recommendedOutputFormat: 'image/jpeg',
    fileSize: {
      isSpecified: false, // Central FAQ does NOT specify a universal digital KB ceiling!
      officialDescription: 'Official requirement not specified in central FAQ (depends on specific consular/TLScontact/VFS portal)',
    },
    pixelDimensions: {
      isSpecified: false, // Central FAQ specifies physical dimensions, NOT universal pixel bounds!
      officialDescription: 'Official requirement not specified in pixels (standard 35 × 45 mm at 300 DPI is ~413 × 531 px; at 600 DPI is ~826 × 1062 px)',
    },
    physicalDimensions: {
      isSpecified: true,
      widthMm: 35,
      heightMm: 45,
      faceHeightMinMm: 32,
      faceHeightMaxMm: 36,
      officialDescription: '35–40 mm width × 45 mm height; face height 32–36 mm from chin to top of hair',
    },
    aspectRatio: {
      isSpecified: true,
      width: 7,
      height: 9,
      description: '7:9 physical aspect ratio (35 mm width × 45 mm height)',
    },
    faceOccupancy: {
      isSpecified: true,
      minPercent: 70,
      maxPercent: 80,
      description: 'Face must occupy between 70% and 80% of the photograph height (32 to 36 mm)',
    },
    softwareTransformationPermitted: false,
    requiresOriginalUnedited: true,
    isExamSpecificOrVolatile: true,
    officialSourceUrl: 'https://www.france-visas.gouv.fr/en/faq',
    verificationDate: '2026-11-16',
    scopeAndLimitations:
      'Official France-Visas FAQ specifies physical photo standards: 35–40 mm width, 45 mm height, face height 32–36 mm (70–80% of image), light grey or light blue background (plain white backgrounds are often rejected by French consulates). Universal digital pixel dimensions and file size limits are not standardized in the central FAQ and depend on the external visa service portal (e.g. TLScontact, VFS Global). Custom DPI (e.g. 300 DPI -> 413×531 px; 600 DPI -> 826×1062 px) is a user-selected print-output setting, not an official digital-upload mandate.',
    warningNotice:
      'INSTRUCTION & CHECKER MODE: France-Visas central FAQ standardizes physical photo dimensions (35×45 mm, 70–80% face height), but does NOT specify universal digital pixel dimensions or file size limits. FileFix operates in checker/instruction mode without inventing digital constraints; verify portal-specific limits on your active submission portal.',
    defaultFittingMode: 'center-crop',
    defaultTargetKb: 200,
    fileFixRecommendations: [
      'Ensure background is light grey or light blue (not pure white and not patterned).',
      'Ensure the face occupies 70% to 80% of the frame without head tilting or hair covering the face.',
      'If printing, use 300 DPI (413×531 px) or 600 DPI (826×1062 px) as a user print-output setting on photo paper.',
    ],
  },
  {
    id: 'upsc-generic-photo',
    displayName: 'UPSC Online (Generic FAQ) — Candidate Photograph',
    shortName: 'UPSC Generic Photo',
    country: 'India',
    issuingAuthority: 'Union Public Service Commission (UPSC), India',
    applicationName: 'UPSC One Time Registration (OTR) / Online Application — Generic FAQ',
    category: 'photo',
    mode: 'transform',
    allowedInputFormats: ['image/jpeg', 'image/jpg'],
    allowedOutputFormats: ['image/jpeg'],
    recommendedOutputFormat: 'image/jpeg',
    fileSize: {
      isSpecified: true,
      minBytes: 20480, // 20 KB exact official floor (20 * 1024)
      maxBytes: 307200, // 300 KB exact official ceiling (300 * 1024)
      officialDescription: 'Strictly between 20 KB and 300 KB (UPSC OTR Generic FAQ)',
    },
    pixelDimensions: {
      isSpecified: true,
      minWidth: 350,
      maxWidth: 1000,
      minHeight: 350,
      maxHeight: 1000,
      exactWidth: 350,
      exactHeight: 350,
      officialDescription: 'Minimum 350 × 350 pixels, maximum 1000 × 1000 pixels (Square 1:1)',
    },
    aspectRatio: {
      isSpecified: true,
      width: 1,
      height: 1,
      description: '1:1 (Square)',
    },
    softwareTransformationPermitted: true,
    requiresOriginalUnedited: true,
    isExamSpecificOrVolatile: true,
    officialSourceUrl: 'https://upsconline.gov.in/upsc/OTRP/candidate/faq.php',
    verificationDate: '2026-11-16',
    scopeAndLimitations:
      'Current UPSC OTR Generic Candidate FAQ specifies: JPEG format, both photograph and signature between 20 KB and 300 KB, and dimensions between 350 × 350 pixels minimum and 1000 × 1000 pixels maximum. Specific active examination notifications may mandate additional conditions or live webcam capture.',
    warningNotice:
      'EXAMINATION SPECIFIC NOTICE: The generic OTR FAQ allows 20–300 KB and 350–1000 px. However, certain individual examination notifications (e.g. Civil Services, CDS) mandate candidate name and date printed on the photo, or require live webcam capture. Always verify against your active examination notification.',
    defaultFittingMode: 'center-crop',
    defaultTargetKb: 100,
    fileFixRecommendations: [
      'Center-crop to square (1:1) and resize to at least 350×350 px.',
      'Target file size between 40 KB and 150 KB to stay safely within the 20–300 KB boundary.',
    ],
  },
  {
    id: 'upsc-generic-signature',
    displayName: 'UPSC Online (Generic FAQ) — Candidate Signature',
    shortName: 'UPSC Generic Signature',
    country: 'India',
    issuingAuthority: 'Union Public Service Commission (UPSC), India',
    applicationName: 'UPSC One Time Registration (OTR) / Online Application — Generic FAQ',
    category: 'signature',
    mode: 'transform',
    allowedInputFormats: ['image/jpeg', 'image/jpg', 'image/png'],
    allowedOutputFormats: ['image/jpeg'],
    recommendedOutputFormat: 'image/jpeg',
    fileSize: {
      isSpecified: true,
      minBytes: 20480, // 20 KB exact official floor
      maxBytes: 307200, // 300 KB exact official ceiling
      officialDescription: 'Strictly between 20 KB and 300 KB (UPSC OTR Generic FAQ)',
    },
    pixelDimensions: {
      isSpecified: true,
      minWidth: 350,
      maxWidth: 1000,
      minHeight: 350,
      maxHeight: 1000,
      exactWidth: 350,
      exactHeight: 350,
      officialDescription: 'Minimum 350 × 350 pixels, maximum 1000 × 1000 pixels (Square 1:1)',
    },
    aspectRatio: {
      isSpecified: true,
      width: 1,
      height: 1,
      description: '1:1 (Square)',
    },
    softwareTransformationPermitted: true,
    requiresOriginalUnedited: false,
    isExamSpecificOrVolatile: true,
    officialSourceUrl: 'https://upsconline.gov.in/upsc/OTRP/candidate/faq.php',
    verificationDate: '2026-11-16',
    scopeAndLimitations:
      'Current UPSC OTR Generic Candidate FAQ specifies: JPEG format, signature file size strictly between 20 KB and 300 KB, dimensions between 350 × 350 px min and 1000 × 1000 px max. Must be signed with black or dark ink on white paper.',
    warningNotice:
      'SIGNATURE INTEGRITY: FileFix scales and pads your signature on a white background without altering stroke shapes, thinning lines, or applying artificial binarization.',
    defaultFittingMode: 'pad-white',
    defaultTargetKb: 80,
    fileFixRecommendations: [
      'Use Pad with White mode so signature aspect ratio is completely preserved and never cropped.',
      'Sign with black ink on clean white paper under uniform lighting.',
    ],
  },
  {
    id: 'ssc-cgl-2026-signature',
    displayName: 'SSC CGL 2026 Examination Notice — Candidate Signature',
    shortName: 'SSC CGL 2026 Signature',
    country: 'India',
    issuingAuthority: 'Staff Selection Commission (SSC), India',
    applicationName: 'Combined Graduate Level Examination (CGL) 2026 Official Notice',
    category: 'signature',
    mode: 'transform',
    allowedInputFormats: ['image/jpeg', 'image/jpg', 'image/png'],
    allowedOutputFormats: ['image/jpeg'],
    recommendedOutputFormat: 'image/jpeg',
    fileSize: {
      isSpecified: true,
      minBytes: 10240, // 10.0 KB exact official floor
      maxBytes: 20480, // 20.0 KB exact official ceiling
      officialDescription: 'Strictly between 10.0 KB and 20.0 KB (SSC CGL 2026 Notice)',
    },
    pixelDimensions: {
      isSpecified: false, // Notice specifies cm, not mandatory pixels!
      officialDescription: 'Pixel dimensions not specified in official notice (approx. 472 × 236 px at 300 DPI mathematical estimate)',
    },
    physicalDimensions: {
      isSpecified: true,
      widthCm: 4.0,
      heightCm: 2.0,
      officialDescription: 'Approximately 4.0 cm width × 2.0 cm height (~2:1 physical ratio)',
    },
    aspectRatio: {
      isSpecified: true,
      width: 2,
      height: 1,
      description: '2:1 (~4.0 cm × 2.0 cm physical ratio)',
    },
    softwareTransformationPermitted: true,
    requiresOriginalUnedited: false,
    isExamSpecificOrVolatile: true,
    officialSourceUrl: 'https://ssc.gov.in/',
    sourcePublicationDate: '2026-01-01',
    verificationDate: '2026-11-16',
    scopeAndLimitations:
      'Official SSC CGL 2026 examination notice specifies: candidate signature in JPEG/JPG format, file size strictly between 10.0 KB and 20.0 KB, physical dimensions approximately 4.0 cm width × 2.0 cm height (~2:1 ratio). Digital pixel dimensions are not officially mandated; 472 × 236 px is a mathematical estimate at 300 DPI.',
    warningNotice:
      'CRITICAL SSC LIVE PHOTO MANDATE: SSC CGL 2026 requires candidate photographs to be captured live using the official portal webcam or MySSC mobile app. Uploaded photo files are NOT accepted for candidates. Only candidate signatures are uploaded as files (10–20 KB, approx. 4.0 × 2.0 cm).',
    defaultFittingMode: 'pad-white',
    defaultTargetKb: 15,
    fileFixRecommendations: [
      'Use Pad with White mode to scale signature onto a ~2:1 white canvas without cropping.',
      'Sign with black ink on clean white paper under uniform lighting.',
      'Target 15 KB to sit safely within the 10.0–20.0 KB official boundary.',
    ],
  },
  {
    id: 'ssc-chsl-2026-signature',
    displayName: 'SSC CHSL 2026 Examination Notice — Candidate Signature',
    shortName: 'SSC CHSL 2026 Signature',
    country: 'India',
    issuingAuthority: 'Staff Selection Commission (SSC), India',
    applicationName: 'Combined Higher Secondary (10+2) Level Examination (CHSL) 2026 Notice',
    category: 'signature',
    mode: 'transform',
    allowedInputFormats: ['image/jpeg', 'image/jpg', 'image/png'],
    allowedOutputFormats: ['image/jpeg'],
    recommendedOutputFormat: 'image/jpeg',
    fileSize: {
      isSpecified: true,
      minBytes: 10240, // 10.0 KB exact official floor
      maxBytes: 20480, // 20.0 KB exact official ceiling
      officialDescription: 'Strictly between 10.0 KB and 20.0 KB (SSC CHSL 2026 Notice)',
    },
    pixelDimensions: {
      isSpecified: false, // Notice specifies cm, not mandatory pixels!
      officialDescription: 'Pixel dimensions not specified in official notice (approx. 708 × 236 px at 300 DPI mathematical estimate)',
    },
    physicalDimensions: {
      isSpecified: true,
      widthCm: 6.0,
      heightCm: 2.0,
      officialDescription: 'Approximately 6.0 cm width × 2.0 cm height (~3:1 physical ratio)',
    },
    aspectRatio: {
      isSpecified: true,
      width: 3,
      height: 1,
      description: '3:1 (~6.0 cm × 2.0 cm physical ratio)',
    },
    softwareTransformationPermitted: true,
    requiresOriginalUnedited: false,
    isExamSpecificOrVolatile: true,
    officialSourceUrl: 'https://ssc.gov.in/',
    sourcePublicationDate: '2026-01-01',
    verificationDate: '2026-11-16',
    scopeAndLimitations:
      'Official SSC CHSL 2026 examination notice specifies: candidate signature in JPEG/JPG format, file size strictly between 10.0 KB and 20.0 KB, physical dimensions approximately 6.0 cm width × 2.0 cm height (~3:1 ratio). Digital pixel dimensions are not officially mandated; 708 × 236 px is a mathematical estimate at 300 DPI.',
    warningNotice:
      'CRITICAL SSC LIVE PHOTO MANDATE: SSC CHSL 2026 requires candidate photographs to be captured live using the official portal webcam or MySSC mobile app. Uploaded photo files are NOT accepted for candidates. Only candidate signatures are uploaded as files (10–20 KB, approx. 6.0 × 2.0 cm).',
    defaultFittingMode: 'pad-white',
    defaultTargetKb: 15,
    fileFixRecommendations: [
      'Use Pad with White mode to scale signature onto a ~3:1 white canvas without cropping.',
      'Sign with black ink on clean white paper under uniform lighting.',
      'Target 15 KB to sit safely within the 10.0–20.0 KB official boundary.',
    ],
  },
  {
    id: 'custom-application',
    displayName: 'Custom Application Profile — User Configured',
    shortName: 'Custom Profile',
    country: 'International',
    issuingAuthority: 'User Defined Portal',
    applicationName: 'General Form / University / Portal Submission',
    category: 'custom',
    mode: 'transform',
    allowedInputFormats: ['image/jpeg', 'image/png', 'image/webp'],
    allowedOutputFormats: ['image/jpeg', 'image/png', 'image/webp'],
    recommendedOutputFormat: 'image/jpeg',
    fileSize: {
      isSpecified: false,
      officialDescription: 'User specified',
    },
    pixelDimensions: {
      isSpecified: false,
      officialDescription: 'User specified',
    },
    aspectRatio: {
      isSpecified: false,
      description: 'User specified',
    },
    softwareTransformationPermitted: true,
    requiresOriginalUnedited: false,
    isExamSpecificOrVolatile: false,
    officialSourceUrl: '',
    verificationDate: '2026-11-16',
    scopeAndLimitations: 'Configure custom dimensions, aspect ratios, and target file sizes according to your portal instructions.',
    defaultFittingMode: 'center-crop',
    defaultTargetKb: 100,
    fileFixRecommendations: [
      'Check your application portal instructions for exact pixel or millimeter limits.',
    ],
  },
];

export function getPresetById(id: string): ApplicationPreset {
  const found = APPLICATION_PRESETS.find((p) => p.id === id);
  return found || APPLICATION_PRESETS[0];
}

export interface ValidationTarget {
  width: number;
  height: number;
  sizeBytes: number;
  format: string;
}

export function validatePresetCompliance(
  target: ValidationTarget,
  preset: ApplicationPreset,
  customConfig?: { width?: number; height?: number; maxKb?: number; minKb?: number }
): ComplianceReport {
  const items: ComplianceCheckItem[] = [];

  // Special Mode: Checker-Only (e.g. U.S. Passport Renewal)
  const isCheckerOnly = preset.mode === 'checker-only';

  // 1. Pixel Width Check
  if (preset.pixelDimensions.isSpecified) {
    const minW = customConfig?.width || preset.pixelDimensions.minWidth || 1;
    const maxW = customConfig?.width || preset.pixelDimensions.maxWidth || 10000;
    const passed = target.width >= minW && target.width <= maxW;
    items.push({
      id: 'width',
      name: 'Pixel Width',
      status: passed ? 'TECHNICAL_PASS' : 'TECHNICAL_FAIL',
      statusLabel: passed ? 'Technical check passed' : 'Technical check failed',
      actual: `${target.width} px`,
      expected: minW === maxW ? `${minW} px` : `${minW}–${maxW} px`,
      isOfficialRequirement: true,
    });
  } else {
    items.push({
      id: 'width',
      name: 'Pixel Width',
      status: 'NOT_SPECIFIED',
      statusLabel: 'Official requirement not specified',
      actual: `${target.width} px`,
      expected: preset.pixelDimensions.officialDescription,
      isOfficialRequirement: false,
      notes: 'Portal does not publish a mandatory pixel width constraint.',
    });
  }

  // 2. Pixel Height Check
  if (preset.pixelDimensions.isSpecified) {
    const minH = customConfig?.height || preset.pixelDimensions.minHeight || 1;
    const maxH = customConfig?.height || preset.pixelDimensions.maxHeight || 10000;
    const passed = target.height >= minH && target.height <= maxH;
    items.push({
      id: 'height',
      name: 'Pixel Height',
      status: passed ? 'TECHNICAL_PASS' : 'TECHNICAL_FAIL',
      statusLabel: passed ? 'Technical check passed' : 'Technical check failed',
      actual: `${target.height} px`,
      expected: minH === maxH ? `${minH} px` : `${minH}–${maxH} px`,
      isOfficialRequirement: true,
    });
  } else {
    items.push({
      id: 'height',
      name: 'Pixel Height',
      status: 'NOT_SPECIFIED',
      statusLabel: 'Official requirement not specified',
      actual: `${target.height} px`,
      expected: preset.pixelDimensions.officialDescription,
      isOfficialRequirement: false,
      notes: 'Portal does not publish a mandatory pixel height constraint.',
    });
  }

  // 3. Aspect Ratio Check
  if (preset.aspectRatio.isSpecified && preset.aspectRatio.width && preset.aspectRatio.height) {
    let passed = false;
    const actualRatio = target.width / target.height;
    const expectedRatio = preset.aspectRatio.width / preset.aspectRatio.height;

    if (preset.aspectRatio.exactSquareRequired) {
      passed = target.width === target.height;
    } else {
      const tolerance = preset.aspectRatio.tolerance ?? 0.05; // Default 5% tolerance
      const delta = Math.abs(actualRatio - expectedRatio);
      passed = delta <= tolerance;
    }

    items.push({
      id: 'aspect-ratio',
      name: 'Aspect Ratio',
      status: passed ? 'TECHNICAL_PASS' : 'TECHNICAL_FAIL',
      statusLabel: passed ? 'Technical check passed' : 'Technical check failed',
      actual: `${actualRatio.toFixed(2)}:1 (${target.width}×${target.height})`,
      expected: preset.aspectRatio.exactSquareRequired
        ? 'Exact 1:1 Square (width === height, zero tolerance)'
        : `${preset.aspectRatio.description} (~${expectedRatio.toFixed(2)}:1)`,
      isOfficialRequirement: true,
      notes:
        preset.aspectRatio.exactSquareRequired && target.width !== target.height
          ? 'Official rules mandate an exact square image. Width must exactly equal height.'
          : undefined,
    });
  } else {
    items.push({
      id: 'aspect-ratio',
      name: 'Aspect Ratio',
      status: 'NOT_SPECIFIED',
      statusLabel: 'Official requirement not specified',
      actual: `${(target.width / target.height).toFixed(2)}:1`,
      expected: preset.aspectRatio.description || 'No mandatory ratio published',
      isOfficialRequirement: false,
    });
  }

  // 4. File Size Check (KB / Bytes)
  if (preset.fileSize.isSpecified && (preset.fileSize.minBytes !== undefined || preset.fileSize.maxBytes !== undefined)) {
    const minB = customConfig?.minKb ? customConfig.minKb * 1024 : preset.fileSize.minBytes ?? 0;
    const maxB = customConfig?.maxKb ? customConfig.maxKb * 1024 : preset.fileSize.maxBytes ?? Infinity;
    const passed = target.sizeBytes >= minB && target.sizeBytes <= maxB;
    const actualKb = (target.sizeBytes / 1024).toFixed(1);
    const minKbStr = (minB / 1024).toFixed(1);
    const maxKbStr = maxB === Infinity ? 'Unlimited' : (maxB / 1024).toFixed(1);

    items.push({
      id: 'file-size',
      name: 'File Size (KB)',
      status: passed ? 'TECHNICAL_PASS' : 'TECHNICAL_FAIL',
      statusLabel: passed ? 'Technical check passed' : 'Technical check failed',
      actual: `${actualKb} KB (${target.sizeBytes.toLocaleString()} bytes)`,
      expected: `${minKbStr} KB to ${maxKbStr} KB`,
      isOfficialRequirement: true,
    });
  } else {
    items.push({
      id: 'file-size',
      name: 'File Size (KB)',
      status: 'NOT_SPECIFIED',
      statusLabel: 'Official requirement not specified',
      actual: `${(target.sizeBytes / 1024).toFixed(1)} KB`,
      expected: preset.fileSize.officialDescription,
      isOfficialRequirement: false,
      notes: 'Digital file size ceiling not published in primary source.',
    });
  }

  // 5. Image Format Check
  const allowed = isCheckerOnly ? preset.allowedInputFormats : preset.allowedOutputFormats;
  const normalizedTarget = target.format === 'image/jpg' ? 'image/jpeg' : target.format;
  const formatPassed = allowed.some((f) => (f === 'image/jpg' ? 'image/jpeg' : f) === normalizedTarget);
  items.push({
    id: 'format',
    name: isCheckerOnly ? 'Original Image Format' : 'Output File Format',
    status: formatPassed ? 'TECHNICAL_PASS' : 'TECHNICAL_FAIL',
    statusLabel: formatPassed ? 'Technical check passed' : 'Technical check failed',
    actual: target.format.replace('image/', '').toUpperCase(),
    expected: allowed.map((f) => f.replace('image/', '').toUpperCase()).join(' or '),
    isOfficialRequirement: true,
  });

  // 6. Unverified Visual / Physical Items (Informational)
  if (preset.physicalDimensions && preset.physicalDimensions.isSpecified) {
    items.push({
      id: 'physical-dims',
      name: 'Physical Print Dimensions',
      status: 'UNVERIFIED_VISUAL',
      statusLabel: 'Visual requirement not automatically verified',
      actual: 'Pixel file (DPI dependent)',
      expected: preset.physicalDimensions.officialDescription,
      isOfficialRequirement: true,
      notes: 'Physical dimensions apply when printed or scaled to official DPI standards.',
    });
  }

  if (preset.faceOccupancy && preset.faceOccupancy.isSpecified) {
    items.push({
      id: 'face-occupancy',
      name: 'Face Height Proportion',
      status: 'UNVERIFIED_VISUAL',
      statusLabel: 'Visual requirement not automatically verified',
      actual: 'Face detection not executed in browser',
      expected: preset.faceOccupancy.description,
      isOfficialRequirement: true,
      notes: 'Requires visual inspection: chin-to-crown height must meet official proportion.',
    });
  }

  if (preset.id === 'us-visa-ds160') {
    items.push({
      id: 'srgb-color',
      name: 'Color Space (sRGB 24-bit)',
      status: 'UNVERIFIED_VISUAL',
      statusLabel: 'Visual requirement not automatically verified',
      actual: 'Standard browser canvas export',
      expected: '24-bit color in sRGB color space',
      isOfficialRequirement: true,
      notes: 'ICC color profile not directly inspected by browser canvas.',
    });
    items.push({
      id: 'compression-ratio',
      name: 'Compression Ratio (<= 20:1)',
      status: 'UNVERIFIED_VISUAL',
      statusLabel: 'Visual requirement not automatically verified',
      actual: 'Optimized JPEG stream',
      expected: 'Equal to or less than 20:1',
      isOfficialRequirement: true,
      notes: 'Uncompressed-to-compressed raw ratio is not measured directly.',
    });
  }

  // Determine Overall Verdict
  let overallVerdict: OverallComplianceVerdict;
  let verdictTitle: string;
  let verdictDescription: string;

  const hasTechnicalFailure = items.some(
    (i) => i.isOfficialRequirement && i.status === 'TECHNICAL_FAIL'
  );

  if (isCheckerOnly) {
    overallVerdict = 'CHECKER_ONLY_MODE';
    verdictTitle = hasTechnicalFailure
      ? 'Technical checks failed (Inspection Mode)'
      : 'Technical checks passed (Inspection Mode)';
    verdictDescription =
      preset.id === 'us-passport-renewal'
        ? 'U.S. Passport Renewal strictly prohibits software alterations. FileFix only verifies your existing file properties without modifying or generating a transformed submit file.'
        : `${preset.displayName} is evaluated in instruction and inspection mode. FileFix verifies baseline technical properties without generating an altered submit file.`;
  } else if (hasTechnicalFailure) {
    overallVerdict = 'TECHNICAL_CHECKS_FAILED';
    verdictTitle = 'Technical checks failed';
    verdictDescription =
      'One or more official technical parameters (dimensions, file size, or format) violate government portal rules.';
  } else {
    overallVerdict = 'TECHNICAL_CHECKS_PASSED';
    verdictTitle = 'Technical checks passed';
    verdictDescription =
      'Measured dimensions, file size, and format adhere to official portal constraints. Biometric and visual parameters must be verified manually.';
  }

  const unverifiedVisualNotice =
    'Visual requirements not automatically verified: Portal review systems inspect lighting uniformity, background color, eye level, neutral expression, and facial proportions. Technical validation of dimensions and bytes does not guarantee biometric or human acceptance.';

  const uneditedPhotoWarning = preset.requiresOriginalUnedited
    ? `OFFICIAL REQUIREMENT: ${preset.issuingAuthority} requires an original, unedited photograph. Using digital editing, filters, background replacements, or AI enhancements risks immediate rejection by consular/portal authorities.`
    : undefined;

  const reVerificationNotice = preset.isExamSpecificOrVolatile
    ? `Source requires re-verification: Requirements for ${preset.applicationName} may vary across specific notifications or mandate live webcam capture. Always confirm against your active examination notification.`
    : undefined;

  return {
    overallVerdict,
    verdictTitle,
    verdictDescription,
    items,
    unverifiedVisualNotice,
    uneditedPhotoWarning,
    reVerificationNotice,
    fileFixRecommendations: preset.fileFixRecommendations,
  };
}
