import { ApplicationPreset, ComplianceReport, ComplianceCheckItem } from '../types';

export const APPLICATION_PRESETS_VERSION = '1.0.0';

export const APPLICATION_PRESETS: ApplicationPreset[] = [
  {
    id: 'us-visa-ds160',
    name: 'U.S. Visa Digital Photograph (DS-160 / CEAC)',
    shortName: 'U.S. Visa (DS-160)',
    category: 'photo',
    issuingAuthority: 'U.S. Department of State — Consular Electronic Application Center (CEAC)',
    applicationType: 'Nonimmigrant Visa (DS-160) & Immigrant Visa Digital Photo',
    officialSourceUrl: 'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html',
    verificationDate: '2026-11-16',
    minWidth: 600,
    maxWidth: 1200,
    minHeight: 600,
    maxHeight: 1200,
    exactWidth: 600,
    exactHeight: 600,
    aspectRatio: {
      width: 1,
      height: 1,
      description: '1:1 (Square)',
    },
    minBytes: 1024, // 1 KB (no official minimum specified; only <=240 KB ceiling)
    maxBytes: 245760, // 240 KB exact official ceiling (240 * 1024 bytes)
    minKbDescription: 'None (or >0 KB)',
    maxKbDescription: '240 KB (Official maximum)',
    allowedFormats: ['image/jpeg'],
    recommendedFormat: 'image/jpeg',
    constraints: [
      'Image file size must be less than or equal to 240 KB.',
      'Dimensions must be square: minimum 600 × 600 pixels, maximum 1200 × 1200 pixels.',
      'Color format must be 24-bit sRGB color space JPEG.',
      'Image compression ratio must be less than or equal to 20:1.',
      'Plain white or off-white background with zero patterns or shadows.',
    ],
    warnings: [
      'CRITICAL: Must be an original, unedited photo taken within the last 6 months. Digitally altered, filtered, retouched, or AI-generated photos are strictly rejected by consular officers.',
      'Technical validation confirms only pixel dimensions and file size. It does NOT guarantee biometric compliance (eye height 56-69% from bottom, head size 50-69%, neutral expression, no glasses).',
    ],
    requiresUneditedOriginal: true,
    defaultFittingMode: 'center-crop',
    defaultTargetKb: 200,
  },
  {
    id: 'us-passport-renewal',
    name: 'U.S. Passport Online Renewal (OPR)',
    shortName: 'U.S. Passport Renewal',
    category: 'photo',
    issuingAuthority: 'U.S. Department of State — Bureau of Consular Affairs',
    applicationType: 'Online Passport Renewal (OPR) Portal',
    officialSourceUrl: 'https://travel.state.gov/content/travel/en/passports/have-passport/renew-online.html',
    verificationDate: '2026-11-16',
    minWidth: 600,
    maxWidth: 1200,
    minHeight: 600,
    maxHeight: 1200,
    exactWidth: 600,
    exactHeight: 600,
    aspectRatio: {
      width: 1,
      height: 1,
      description: '1:1 (Square)',
    },
    minBytes: 55296, // 54 KB exact official minimum (54 * 1024 bytes)
    maxBytes: 10485760, // 10 MB exact official maximum (10 * 1024 * 1024 bytes)
    minKbDescription: '54 KB (Official minimum)',
    maxKbDescription: '10 MB (Official maximum)',
    allowedFormats: ['image/jpeg', 'image/png'],
    recommendedFormat: 'image/jpeg',
    constraints: [
      'Image file size must be between 54 KB and 10 MB.',
      'Dimensions must be square: minimum 600 × 600 pixels, maximum 1200 × 1200 pixels.',
      'Accepted file formats: JPEG (.jpg/.jpeg) or PNG (.png).',
      'Plain white or off-white background with no textures, patterns, or cast shadows.',
    ],
    warnings: [
      'OFFICIAL GUIDANCE WARNING: Official Department of State rules require an original, unedited photograph taken by someone else or on a tripod. Official guidance explicitly states: "Do not use software-edited, digitally altered, filtered, or AI-enhanced photographs." FileFix only provides technical dimension and file-size compliance.',
      'Automated passport photo checkers inspect lighting, background uniformity, head size, and natural skin texture. Software manipulation risks application rejection.',
    ],
    requiresUneditedOriginal: true,
    defaultFittingMode: 'center-crop',
    defaultTargetKb: 500,
  },
  {
    id: 'schengen-visa-france',
    name: 'Schengen Visa (France-Visas Online Portal)',
    shortName: 'Schengen Visa (France)',
    category: 'photo',
    issuingAuthority: "France-Visas / Ministère de l'Intérieur (ICAO Doc 9303 Compliant)",
    applicationType: 'France-Visas Online Application Digital Upload',
    officialSourceUrl: 'https://france-visas.gouv.fr/en/web/france-visas/photo-standards',
    verificationDate: '2026-11-16',
    minWidth: 413,
    maxWidth: 826,
    minHeight: 531,
    maxHeight: 1062,
    exactWidth: 413,
    exactHeight: 531,
    aspectRatio: {
      width: 7,
      height: 9,
      description: '35:45 (7:9 ratio, corresponding to 35 × 45 mm at 300 DPI)',
    },
    minBytes: 1024, // 1 KB (no official portal minimum specified; only <=300 KB ceiling)
    maxBytes: 307200, // 300 KB exact France-Visas upload limit (300 * 1024 bytes)
    minKbDescription: 'None (or >0 KB)',
    maxKbDescription: '300 KB (Portal upload limit)',
    allowedFormats: ['image/jpeg'],
    recommendedFormat: 'image/jpeg',
    constraints: [
      'Physical aspect ratio: 35 mm width × 45 mm height (approx 413 × 531 pixels at 300 DPI).',
      'Maximum digital upload size on France-Visas portal: 300 KB.',
      'Format must be JPEG (.jpg/.jpeg).',
      'Light grey or light blue background (plain white backgrounds are often rejected by French consulates).',
    ],
    warnings: [
      'PORTAL VARIATION NOTICE: Schengen visa digital upload rules are set by the individual member state. This profile specifically targets the France-Visas portal. Other member states (e.g. Germany VIDEX) or physical VFS centers may require physical printouts.',
      'Biometric rule: Face height from chin to crown must occupy between 70% and 80% of the frame (32 to 36 mm).',
    ],
    requiresUneditedOriginal: true,
    defaultFittingMode: 'center-crop',
    defaultTargetKb: 180,
  },
  {
    id: 'upsc-exam-photo',
    name: 'UPSC Online Exam Application — Candidate Photograph',
    shortName: 'UPSC Photo',
    category: 'photo',
    issuingAuthority: 'Union Public Service Commission (UPSC), India',
    applicationType: 'UPSC One Time Registration (OTR) / Examination Portal',
    officialSourceUrl: 'https://upsconline.nic.in',
    verificationDate: '2026-11-16',
    minWidth: 350,
    maxWidth: 1000,
    minHeight: 350,
    maxHeight: 1000,
    exactWidth: 350,
    exactHeight: 350,
    aspectRatio: {
      width: 1,
      height: 1,
      description: '1:1 (Square)',
    },
    minBytes: 20480, // 20 KB exact portal minimum (20 * 1024 bytes)
    maxBytes: 204800, // 200 KB exact portal maximum (200 * 1024 bytes)
    minKbDescription: '20 KB (Strict portal minimum)',
    maxKbDescription: '200 KB (Strict portal maximum)',
    allowedFormats: ['image/jpeg'],
    recommendedFormat: 'image/jpeg',
    constraints: [
      'File size must be strictly between 20 KB and 200 KB.',
      'Dimensions must be square: minimum 350 × 350 pixels, maximum 1000 × 1000 pixels.',
      'Format must be JPEG (.jpg/.jpeg).',
      'Candidate name and date of photo must be displayed if prescribed by your active exam notification.',
    ],
    warnings: [
      'LIVE WEBCAM CAPTURE NOTICE: Recent UPSC notifications mandate live photograph capture via webcam during the application process. Check your specific active exam notification (e.g., Civil Services, CDS, NDA) to verify whether an uploaded file or live webcam capture is mandated.',
      'UPSC upload validation will reject any file smaller than 20 KB or larger than 200 KB.',
    ],
    portalCaptureNotes: 'Check active exam notification: some UPSC stages use live webcam capture while OTR permits uploaded photos.',
    requiresUneditedOriginal: true,
    defaultFittingMode: 'center-crop',
    defaultTargetKb: 80,
  },
  {
    id: 'upsc-exam-signature',
    name: 'UPSC Online Exam Application — Candidate Signature',
    shortName: 'UPSC Signature',
    category: 'signature',
    issuingAuthority: 'Union Public Service Commission (UPSC), India',
    applicationType: 'UPSC One Time Registration (OTR) / Examination Portal',
    officialSourceUrl: 'https://upsconline.nic.in',
    verificationDate: '2026-11-16',
    minWidth: 350,
    maxWidth: 1000,
    minHeight: 350,
    maxHeight: 1000,
    exactWidth: 350,
    exactHeight: 350,
    aspectRatio: {
      width: 1,
      height: 1,
      description: '1:1 (Square)',
    },
    minBytes: 20480, // 20 KB exact portal minimum (20 * 1024 bytes)
    maxBytes: 102400, // 100 KB exact portal maximum (100 * 1024 bytes)
    minKbDescription: '20 KB (Strict portal minimum)',
    maxKbDescription: '100 KB (Strict portal maximum)',
    allowedFormats: ['image/jpeg'],
    recommendedFormat: 'image/jpeg',
    constraints: [
      'File size must be strictly between 20 KB and 100 KB.',
      'Dimensions must be square: minimum 350 × 350 pixels, maximum 1000 × 1000 pixels.',
      'Format must be JPEG (.jpg/.jpeg).',
      'Sign with black or dark blue ink pen on plain white paper.',
    ],
    warnings: [
      'SIGNATURE PRESERVATION: FileFix does NOT alter, retrace, or thin your signature strokes. Transparent signatures are cleanly placed on a solid white background to prevent dark background rendering in JPEG.',
      'Uploads outside the 20 KB to 100 KB boundary or with non-square dimensions are blocked by the portal server.',
    ],
    requiresUneditedOriginal: false,
    defaultFittingMode: 'pad-white',
    defaultTargetKb: 50,
  },
  {
    id: 'ssc-exam-signature',
    name: 'SSC Examination Portal — Candidate Signature',
    shortName: 'SSC Signature',
    category: 'signature',
    issuingAuthority: 'Staff Selection Commission (SSC), India',
    applicationType: 'SSC Online Application / One Time Registration',
    officialSourceUrl: 'https://ssc.gov.in',
    verificationDate: '2026-11-16',
    minWidth: 140,
    maxWidth: 280,
    minHeight: 60,
    maxHeight: 120,
    exactWidth: 140,
    exactHeight: 60,
    aspectRatio: {
      width: 7,
      height: 3,
      description: '7:3 (140 × 60 px)',
    },
    minBytes: 10240, // 10 KB exact portal minimum (10 * 1024 bytes)
    maxBytes: 20480, // 20 KB exact portal maximum (20 * 1024 bytes)
    minKbDescription: '10 KB (Strict portal minimum)',
    maxKbDescription: '20 KB (Strict portal maximum)',
    allowedFormats: ['image/jpeg'],
    recommendedFormat: 'image/jpeg',
    constraints: [
      'File size must be strictly between 10.0 KB and 20.0 KB.',
      'Standard pixel dimensions: 140 pixels width × 60 pixels height.',
      'Format must be JPEG (.jpg/.jpeg).',
      'Sign with a black or dark blue pen on clean white paper.',
    ],
    warnings: [
      'CRITICAL SSC PHOTO POLICY NOTICE: The Staff Selection Commission (SSC) NO LONGER accepts uploaded photograph files! Candidate photographs must be captured live through the official webcam portal or the "MySSC" Android mobile application. Only candidate SIGNATURES are uploaded as files.',
      'Portals strictly reject signature files that fall below 10 KB or exceed 20 KB.',
    ],
    portalCaptureNotes: 'SSC strictly requires live webcam photo capture; only signatures are uploaded as files.',
    requiresUneditedOriginal: false,
    defaultFittingMode: 'pad-white',
    defaultTargetKb: 15,
  },
  {
    id: 'custom-application',
    name: 'Custom Application Profile',
    shortName: 'Custom Profile',
    category: 'custom',
    issuingAuthority: 'User Defined',
    applicationType: 'General Government / University / Portal Form',
    officialSourceUrl: '',
    verificationDate: '2026-11-16',
    minWidth: 50,
    maxWidth: 4000,
    minHeight: 50,
    maxHeight: 4000,
    exactWidth: 600,
    exactHeight: 600,
    aspectRatio: {
      width: 1,
      height: 1,
      description: 'Custom Aspect Ratio',
    },
    minBytes: 1024,
    maxBytes: 52428800, // 50 MB
    minKbDescription: 'Custom minimum',
    maxKbDescription: 'Custom maximum',
    allowedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    recommendedFormat: 'image/jpeg',
    constraints: [
      'Configured by user according to specific portal instructions.',
    ],
    warnings: [
      'Verify requirements directly against your official application instructions.',
    ],
    requiresUneditedOriginal: false,
    defaultFittingMode: 'center-crop',
    defaultTargetKb: 100,
  },
];

export function getPresetById(id: string): ApplicationPreset {
  const found = APPLICATION_PRESETS.find((p) => p.id === id);
  if (!found) {
    return APPLICATION_PRESETS[0];
  }
  return found;
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

  const minW = customConfig?.width || preset.minWidth;
  const maxW = customConfig?.width || preset.maxWidth;
  const minH = customConfig?.height || preset.minHeight;
  const maxH = customConfig?.height || preset.maxHeight;

  const minB = customConfig?.minKb ? customConfig.minKb * 1024 : preset.minBytes;
  const maxB = customConfig?.maxKb ? customConfig.maxKb * 1024 : preset.maxBytes;

  // 1. Width Check
  const widthPassed = target.width >= minW && target.width <= maxW;
  items.push({
    name: 'Width (pixels)',
    passed: widthPassed,
    actual: `${target.width} px`,
    expected: minW === maxW ? `${minW} px` : `${minW}–${maxW} px`,
    critical: true,
  });

  // 2. Height Check
  const heightPassed = target.height >= minH && target.height <= maxH;
  items.push({
    name: 'Height (pixels)',
    passed: heightPassed,
    actual: `${target.height} px`,
    expected: minH === maxH ? `${minH} px` : `${minH}–${maxH} px`,
    critical: true,
  });

  // 3. Aspect Ratio Check
  if (preset.aspectRatio && preset.aspectRatio.width > 0 && preset.aspectRatio.height > 0) {
    const expectedRatio = preset.aspectRatio.width / preset.aspectRatio.height;
    const actualRatio = target.width / target.height;
    const ratioDelta = Math.abs(actualRatio - expectedRatio);
    const ratioPassed = ratioDelta < 0.05; // 5% tolerance

    items.push({
      name: 'Aspect Ratio',
      passed: ratioPassed,
      actual: `${(actualRatio).toFixed(2)}:1 (${target.width}×${target.height})`,
      expected: `${preset.aspectRatio.description} (~${expectedRatio.toFixed(2)}:1)`,
      critical: false,
    });
  }

  // 4. File Size (Bytes) Check
  const sizePassed = target.sizeBytes >= minB && target.sizeBytes <= maxB;
  const actualKb = (target.sizeBytes / 1024).toFixed(1);
  const minKbStr = (minB / 1024).toFixed(1);
  const maxKbStr = (maxB / 1024).toFixed(1);

  items.push({
    name: 'File Size (KB)',
    passed: sizePassed,
    actual: `${actualKb} KB (${target.sizeBytes.toLocaleString()} bytes)`,
    expected: `${minKbStr} KB to ${maxKbStr} KB`,
    critical: true,
  });

  // 5. File Format Check
  const formatPassed = preset.allowedFormats.includes(target.format as any);
  items.push({
    name: 'Image Format',
    passed: formatPassed,
    actual: target.format.replace('image/', '').toUpperCase(),
    expected: preset.allowedFormats.map((f) => f.replace('image/', '').toUpperCase()).join(' or '),
    critical: true,
  });

  const isTechnicallyCompliant = items.every((i) => !i.critical || i.passed);

  const biometricDisclaimer =
    'Technical validation confirms file format, pixel dimensions, and byte size. It does NOT guarantee biometric acceptance (facial expression, background lighting, eye level, neutral posture, or paper cleanliness).';

  const authorityNotice = preset.requiresUneditedOriginal
    ? `OFFICIAL REQUIREMENT: ${preset.issuingAuthority} requires original, unedited photographs. Do not use AI enhancements, retouching, or synthetic background filters.`
    : `Ensure file corresponds accurately to ${preset.issuingAuthority} application rules.`;

  return {
    isTechnicallyCompliant,
    items,
    biometricDisclaimer,
    authorityNotice,
  };
}
