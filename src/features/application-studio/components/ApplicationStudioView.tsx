'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Eye,
  ExternalLink,
  Download,
  RotateCcw,
  Sliders,
  FileCheck,
  Camera,
  PenTool,
  Info,
  ArrowRight,
} from 'lucide-react';
import { Dropzone } from '../../image-studio/components/Dropzone';
import { ImageMetadata, SupportedOutputFormat } from '../../image-studio/types';
import { formatBytes } from '../../image-studio/lib/image-math';
import {
  APPLICATION_PRESETS,
  getPresetById,
} from '../lib/presets';
import {
  ApplicationResult,
  processApplicationImage,
} from '../lib/application-processor';
import { FittingMode, CheckStatus } from '../types';

export const ApplicationStudioView: React.FC = () => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('us-visa-ds160');
  const [fittingMode, setFittingMode] = useState<FittingMode>('center-crop');
  const [targetKb, setTargetKb] = useState<number>(200);
  const [customWidth, setCustomWidth] = useState<number>(600);
  const [customHeight, setCustomHeight] = useState<number>(600);

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceMetadata, setSourceMetadata] = useState<ImageMetadata | null>(null);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ApplicationResult | null>(null);

  const activePreset = APPLICATION_PRESETS.find((p) => p.id === selectedPresetId) || APPLICATION_PRESETS[0];

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = APPLICATION_PRESETS.find((p) => p.id === presetId) || APPLICATION_PRESETS[0];
    setFittingMode(preset.defaultFittingMode);
    if (preset.defaultTargetKb) {
      setTargetKb(preset.defaultTargetKb);
    }
    if (preset.pixelDimensions.exactWidth && preset.pixelDimensions.exactHeight) {
      setCustomWidth(preset.pixelDimensions.exactWidth);
      setCustomHeight(preset.pixelDimensions.exactHeight);
    }
    setResult(null);
    setErrorMessage(null);
  };

  const handleImageLoaded = (metadata: ImageMetadata, file: File) => {
    setSourceFile(file);
    setSourceMetadata(metadata);
    setResult(null);
    setErrorMessage(null);
  };

  const handleReset = () => {
    if (sourceMetadata?.objectUrl) {
      URL.revokeObjectURL(sourceMetadata.objectUrl);
    }
    if (result?.url && result.blob !== sourceFile) {
      URL.revokeObjectURL(result.url);
    }
    setSourceFile(null);
    setSourceMetadata(null);
    setResult(null);
    setErrorMessage(null);
    setProgressMessage('');
  };

  const handleProcess = async () => {
    if (!sourceFile || !sourceMetadata) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressMessage(
      activePreset.mode === 'checker-only'
        ? 'Inspecting technical properties (Checker Mode)...'
        : 'Initializing application optimizer...'
    );

    try {
      const processed = await processApplicationImage({
        sourceBlob: sourceFile,
        preset: activePreset,
        fittingMode,
        customWidth: activePreset.id === 'custom-application' ? customWidth : undefined,
        customHeight: activePreset.id === 'custom-application' ? customHeight : undefined,
        targetSizeKb: targetKb > 0 ? targetKb : undefined,
        allowDimensionReductionForTarget: false,
        onProgress: (msg) => setProgressMessage(msg),
      });

      setResult(processed);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Application image processing failed.');
    } finally {
      setIsProcessing(false);
      setProgressMessage('');
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    const extension = result.format === 'image/png' ? 'png' : 'jpg';
    a.download = `filefix-${activePreset.id}-${Date.now()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadReport = () => {
    if (!result) return;
    const lines = [
      '==============================================================',
      'FILEFIX APPLICATION TECHNICAL COMPLIANCE REPORT',
      '==============================================================',
      `Application Profile : ${activePreset.displayName}`,
      `Issuing Authority   : ${activePreset.issuingAuthority}`,
      `Application Name    : ${activePreset.applicationName}`,
      `Operational Mode    : ${activePreset.mode === 'checker-only' ? 'Requirements Checker / Instruction Only' : 'Technical Fitting & Compression'}`,
      `Official Source     : ${activePreset.officialSourceUrl || 'Custom Configured'}`,
      `Verification Date   : ${activePreset.verificationDate}`,
      `Generated At        : ${new Date().toISOString()}`,
      '--------------------------------------------------------------',
      `VERDICT: ${result.compliance.verdictTitle.toUpperCase()}`,
      `${result.compliance.verdictDescription}`,
      '--------------------------------------------------------------',
      'DETAILED COMPLIANCE ITEM CHECKS:',
      ...result.compliance.items.map(
        (i) =>
          `[${i.status}] ${i.name.padEnd(25)} : Actual: ${i.actual.padEnd(25)} Expected: ${i.expected}${i.notes ? ` (${i.notes})` : ''}`
      ),
      '--------------------------------------------------------------',
      'IMPORTANT NOTICES & DISCLAIMERS:',
      `1. Visual Requirements: ${result.compliance.unverifiedVisualNotice}`,
      result.compliance.uneditedPhotoWarning
        ? `2. Unedited Photo Rule: ${result.compliance.uneditedPhotoWarning}`
        : '',
      result.compliance.reVerificationNotice
        ? `3. Re-Verification Notice: ${result.compliance.reVerificationNotice}`
        : '',
      '--------------------------------------------------------------',
      'FILEFIX OPERATIONAL RECOMMENDATIONS:',
      ...result.compliance.fileFixRecommendations.map((r, idx) => `• ${r}`),
      '==============================================================',
      'Processed 100% locally in browser memory with zero server uploads.',
    ].filter(Boolean);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${activePreset.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderStatusBadge = (status: CheckStatus, label: string) => {
    switch (status) {
      case 'TECHNICAL_PASS':
        return (
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Pass</span>
          </span>
        );
      case 'TECHNICAL_FAIL':
        return (
          <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>Fail</span>
          </span>
        );
      case 'NOT_SPECIFIED':
        return (
          <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 border border-slate-200">
            <HelpCircle className="w-3 h-3 text-slate-500" />
            <span>Not Specified</span>
          </span>
        );
      case 'UNVERIFIED_VISUAL':
        return (
          <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 border border-amber-200">
            <Eye className="w-3 h-3 text-amber-600" />
            <span>Unverified Visual</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Official Government, Visa & Exam Preset Optimizer</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Application Studio
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Prepare photographs and signatures against verified official requirements. Validates technical boundaries, separates official rules from visual checks, and preserves original images.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/image-studio"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
          >
            Switch to Freeform Image Studio &rarr;
          </Link>
        </div>
      </div>

      {/* Preset Selector Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-2">
            Select Official Application Profile
          </label>
          <select
            value={selectedPresetId}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          >
            <optgroup label="Passports & Visas">
              <option value="us-visa-ds160">
                U.S. Visa (Form DS-160) — 600×600 to 1200×1200 px, ≤240 KB
              </option>
              <option value="us-passport-renewal">
                U.S. Passport Online Renewal (OPR) — Inspection & Checker Mode (54 KB–10 MB)
              </option>
              <option value="france-schengen-visa">
                France / Schengen Visa — 35×45 mm ICAO Physical Guidance
              </option>
            </optgroup>
            <optgroup label="Indian Government Examinations">
              <option value="upsc-generic-photo">
                UPSC Online (Generic FAQ) — Photograph (350×350 to 1000×1000 px, 20–300 KB)
              </option>
              <option value="upsc-generic-signature">
                UPSC Online (Generic FAQ) — Signature (350×350 to 1000×1000 px, 20–300 KB)
              </option>
              <option value="ssc-exam-signature">
                SSC Examination (Official Notice) — Signature (10–20 KB, ~6×2 cm)
              </option>
            </optgroup>
            <optgroup label="Custom Profile">
              <option value="custom-application">Custom Dimensions & KB Limits</option>
            </optgroup>
          </select>
        </div>

        {/* Selected Preset Specification Sheet */}
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {activePreset.country} • {activePreset.issuingAuthority}
                </span>
                {activePreset.mode === 'checker-only' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                    Checker-Only Mode
                  </span>
                )}
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {activePreset.applicationName}
              </div>
            </div>
            {activePreset.officialSourceUrl && (
              <a
                href={activePreset.officialSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs w-fit"
              >
                <span>Official Primary Source</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">Mandatory Pixel Dimensions</span>
              <span className="font-bold text-slate-900 text-sm">
                {activePreset.pixelDimensions.isSpecified
                  ? activePreset.pixelDimensions.officialDescription
                  : 'Official requirement not specified'}
              </span>
              {activePreset.aspectRatio.isSpecified && (
                <span className="text-slate-500 block text-[11px] mt-0.5">
                  Aspect ratio: {activePreset.aspectRatio.description}
                </span>
              )}
            </div>

            <div>
              <span className="text-slate-500 block">Physical Dimensions</span>
              <span className="font-bold text-slate-900 text-sm">
                {activePreset.physicalDimensions?.isSpecified
                  ? activePreset.physicalDimensions.officialDescription
                  : 'Not specified'}
              </span>
              {activePreset.faceOccupancy?.isSpecified && (
                <span className="text-slate-500 block text-[11px] mt-0.5">
                  Face: {activePreset.faceOccupancy.description}
                </span>
              )}
            </div>

            <div>
              <span className="text-slate-500 block">Allowed File Size</span>
              <span className="font-bold text-slate-900 text-sm">
                {activePreset.fileSize.officialDescription}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block">Rule Verification</span>
              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                Verified {activePreset.verificationDate}
              </span>
            </div>
          </div>

          {/* Scope and Official Warning Notices */}
          <div className="space-y-2 pt-2 border-t border-slate-200/80">
            {activePreset.warningNotice && (
              <div className="flex items-start gap-2.5 text-xs bg-amber-50/80 text-amber-900 p-3 rounded-lg border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{activePreset.warningNotice}</p>
              </div>
            )}
            <div className="text-[11px] text-slate-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
              <strong className="text-slate-800">Official Scope & Limitations: </strong>
              {activePreset.scopeAndLimitations}
            </div>
          </div>
        </div>

        {/* Configuration Controls (Disabled or tailored if Checker-Only) */}
        {activePreset.mode === 'checker-only' ? (
          <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Inspection Mode Active</span>
            </div>
            <p className="leading-relaxed">
              Software transformations are disabled for this profile because U.S. Passport Renewal rules strictly prohibit digitally edited photos. FileFix inspects technical file properties without generating an altered submit file.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {/* Fitting Mode */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Aspect Ratio Handling
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFittingMode('center-crop')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    fittingMode === 'center-crop'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs mb-1">
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    <span>Center Crop</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    Crops outer edges to fill frame. Best for portraits.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFittingMode('pad-white')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    fittingMode === 'pad-white'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs mb-1">
                    <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Pad with White</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    Fits full image with white margins. Best for signatures.
                  </p>
                </button>
              </div>
            </div>

            {/* Target File Size */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Target File Size (KB)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={activePreset.fileSize.minBytes ? Math.ceil(activePreset.fileSize.minBytes / 1024) : 1}
                  max={activePreset.fileSize.maxBytes ? Math.floor(activePreset.fileSize.maxBytes / 1024) : 10000}
                  value={targetKb}
                  onChange={(e) => setTargetKb(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <span className="absolute right-4 top-2.5 text-xs font-bold text-slate-400">
                  KB
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Official constraint: {activePreset.fileSize.officialDescription}
              </p>
            </div>
          </div>
        )}

        {/* Custom Dimensions (if custom selected) */}
        {activePreset.id === 'custom-application' && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Custom Width (px)</label>
              <input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(Math.max(50, parseInt(e.target.value) || 50))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Custom Height (px)</label>
              <input
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(Math.max(50, parseInt(e.target.value) || 50))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>
        )}
      </div>

      {/* Upload Dropzone or Active Image Workspace */}
      {!sourceMetadata ? (
        <Dropzone onImageLoaded={handleImageLoaded} isProcessing={isProcessing} />
      ) : (
        <div className="space-y-6">
          {/* Main Action Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">{sourceMetadata.name}</div>
                <div className="text-xs text-slate-500">
                  {sourceMetadata.width} × {sourceMetadata.height} px • {formatBytes(sourceMetadata.sizeBytes)} • {sourceMetadata.format.replace('image/', '').toUpperCase()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Upload Different File</span>
              </button>

              <button
                type="button"
                onClick={handleProcess}
                disabled={isProcessing}
                className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>{progressMessage || 'Processing...'}</span>
                  </>
                ) : (
                  <>
                    <Sliders className="w-3.5 h-3.5" />
                    <span>
                      {activePreset.mode === 'checker-only'
                        ? 'Inspect Photo Compliance'
                        : 'Apply Official Preset'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Before & After Visual Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Original Preview */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider">
                <span>Original Image (Preserved)</span>
                <span className="text-slate-500 font-normal">
                  {sourceMetadata.width} × {sourceMetadata.height} px
                </span>
              </div>
              <div className="h-64 bg-slate-100/70 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sourceMetadata.objectUrl}
                  alt="Original application file"
                  className="max-h-full max-w-full object-contain rounded"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                <span>File size: {formatBytes(sourceMetadata.sizeBytes)}</span>
                <span>Format: {sourceMetadata.format.replace('image/', '').toUpperCase()}</span>
              </div>
            </div>

            {/* Processed / Inspected Preview */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider">
                <span>
                  {activePreset.mode === 'checker-only'
                    ? 'Inspected Photo'
                    : 'Processed Output'}
                </span>
                {result && (
                  <span className="text-emerald-600 font-bold">
                    {result.width} × {result.height} px
                  </span>
                )}
              </div>
              <div className="h-64 bg-slate-100/70 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden p-2 relative">
                {result ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={result.url}
                    alt="Processed application file"
                    className="max-h-full max-w-full object-contain rounded"
                  />
                ) : (
                  <div className="text-center text-xs text-slate-400 space-y-2">
                    <Camera className="w-8 h-8 mx-auto text-slate-300" />
                    <p>
                      Click &ldquo;
                      {activePreset.mode === 'checker-only'
                        ? 'Inspect Photo Compliance'
                        : 'Apply Official Preset'}
                      &rdquo; to analyze
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                {result ? (
                  <>
                    <span className="font-semibold text-slate-900">
                      Output: {formatBytes(result.sizeBytes)} ({result.processingTimeMs} ms)
                    </span>
                    <span className="font-semibold text-slate-900">
                      Format: {result.format.replace('image/', '').toUpperCase()}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400">Waiting for processing...</span>
                )}
              </div>
            </div>
          </div>

          {/* Technical Compliance & Download Report */}
          {result && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex items-center gap-3">
                  {result.compliance.overallVerdict === 'TECHNICAL_CHECKS_PASSED' ? (
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  ) : result.compliance.overallVerdict === 'CHECKER_ONLY_MODE' ? (
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Info className="w-6 h-6" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                      <XCircle className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {result.compliance.verdictTitle}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {result.compliance.verdictDescription}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadReport}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Export Compliance Report (.txt)
                  </button>
                  {activePreset.mode === 'checker-only' ? (
                    <a
                      href={activePreset.officialSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open Official Portal</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Image</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Compliance Item Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.compliance.items.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      item.status === 'TECHNICAL_PASS'
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : item.status === 'TECHNICAL_FAIL'
                        ? 'bg-rose-50/40 border-rose-200'
                        : item.status === 'UNVERIFIED_VISUAL'
                        ? 'bg-amber-50/40 border-amber-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-800">{item.name}</span>
                      {renderStatusBadge(item.status, item.statusLabel)}
                    </div>
                    <div className="text-slate-600 text-[11px] space-y-0.5">
                      <div>
                        Actual: <strong className="text-slate-900">{item.actual}</strong>
                      </div>
                      <div>Expected: {item.expected}</div>
                      {item.notes && (
                        <div className="text-[10px] text-slate-500 italic mt-0.5">{item.notes}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Warnings, Visual Notices & FileFix Recommendations */}
              <div className="space-y-3 pt-2">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
                  <div className="flex items-start gap-2 text-slate-800 font-semibold">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>Visual Requirements & Biometric Notice:</span>
                  </div>
                  <p className="leading-relaxed pl-6">
                    {result.compliance.unverifiedVisualNotice}
                  </p>
                  {result.compliance.uneditedPhotoWarning && (
                    <p className="leading-relaxed pl-6 font-medium text-amber-900">
                      {result.compliance.uneditedPhotoWarning}
                    </p>
                  )}
                  {result.compliance.reVerificationNotice && (
                    <p className="leading-relaxed pl-6 font-medium text-indigo-900">
                      {result.compliance.reVerificationNotice}
                    </p>
                  )}
                </div>

                {result.compliance.fileFixRecommendations.length > 0 && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs space-y-1.5">
                    <div className="font-bold text-slate-800">
                      FileFix Operational Recommendations (Distinct from Official Rules):
                    </div>
                    <ul className="list-disc list-inside text-slate-600 space-y-1 pl-1">
                      {result.compliance.fileFixRecommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
