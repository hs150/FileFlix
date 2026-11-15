'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ImageMetadata,
  ResizeSettings,
  CropSettings,
  CompressionSettings,
  ProcessingResult,
  ProcessingState,
  SupportedOutputFormat,
} from '../types';
import { Dropzone } from './Dropzone';
import { processImageLocally } from '../lib/image-processor';
import {
  formatBytes,
  calculatePercentageChange,
  calculateHeightFromWidth,
  calculateWidthFromHeight,
} from '../lib/image-math';
import {
  Lock,
  Unlock,
  Crop,
  Maximize2,
  Sliders,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  FileImage,
} from 'lucide-react';

export const ImageStudioView: React.FC = () => {
  // Input File State
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceMeta, setSourceMeta] = useState<ImageMetadata | null>(null);

  // Settings State
  const [resize, setResize] = useState<ResizeSettings>({
    enabled: true,
    width: 0,
    height: 0,
    maintainAspectRatio: true,
  });

  const [crop, setCrop] = useState<CropSettings>({
    enabled: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const [compression, setCompression] = useState<CompressionSettings>({
    format: 'image/jpeg',
    quality: 0.85,
    targetSizeKb: null,
    allowDimensionReductionForTarget: false,
  });

  // Processing & Result State
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    progressMessage: '',
    error: null,
  });
  const [result, setResult] = useState<ProcessingResult | null>(null);

  // Cleanup object URLs on unmount or file reset
  const cleanupResources = useCallback(() => {
    if (sourceMeta?.objectUrl) {
      URL.revokeObjectURL(sourceMeta.objectUrl);
    }
    if (result?.url) {
      URL.revokeObjectURL(result.url);
    }
  }, [sourceMeta, result]);

  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

  // Handle new image uploaded
  const handleImageLoaded = (meta: ImageMetadata, file: File) => {
    cleanupResources();
    setSourceFile(file);
    setSourceMeta(meta);
    setResult(null);
    setProcessingState({ status: 'idle', progressMessage: '', error: null });

    // Initialize defaults based on loaded image
    setResize({
      enabled: true,
      width: meta.width,
      height: meta.height,
      maintainAspectRatio: true,
    });

    setCrop({
      enabled: false,
      x: 0,
      y: 0,
      width: meta.width,
      height: meta.height,
    });

    // Default compression format matching original or WebP
    const defaultFormat: SupportedOutputFormat =
      meta.format === 'image/png' ? 'image/png' : meta.format === 'image/webp' ? 'image/webp' : 'image/jpeg';

    setCompression({
      format: defaultFormat,
      quality: 0.85,
      targetSizeKb: null,
      allowDimensionReductionForTarget: false,
    });
  };

  const handleReset = () => {
    cleanupResources();
    setSourceFile(null);
    setSourceMeta(null);
    setResult(null);
    setProcessingState({ status: 'idle', progressMessage: '', error: null });
  };

  // Dimension Handlers with Aspect Ratio
  const handleWidthChange = (w: number) => {
    if (resize.maintainAspectRatio && sourceMeta) {
      const activeRatio = crop.enabled && crop.height > 0 ? crop.width / crop.height : sourceMeta.aspectRatio;
      setResize((prev) => ({
        ...prev,
        width: w,
        height: calculateHeightFromWidth(w, activeRatio),
      }));
    } else {
      setResize((prev) => ({ ...prev, width: w }));
    }
  };

  const handleHeightChange = (h: number) => {
    if (resize.maintainAspectRatio && sourceMeta) {
      const activeRatio = crop.enabled && crop.height > 0 ? crop.width / crop.height : sourceMeta.aspectRatio;
      setResize((prev) => ({
        ...prev,
        height: h,
        width: calculateWidthFromHeight(h, activeRatio),
      }));
    } else {
      setResize((prev) => ({ ...prev, height: h }));
    }
  };

  const applyScalePreset = (factor: number) => {
    if (!sourceMeta) return;
    const baseW = crop.enabled ? crop.width : sourceMeta.width;
    const baseH = crop.enabled ? crop.height : sourceMeta.height;
    setResize((prev) => ({
      ...prev,
      width: Math.round(baseW * factor),
      height: Math.round(baseH * factor),
    }));
  };

  // Execute in-browser processing
  const handleProcess = async () => {
    if (!sourceFile || !sourceMeta) return;

    try {
      setProcessingState({
        status: 'processing',
        progressMessage: 'Starting local browser processing...',
        error: null,
      });

      // Cleanup previous result URL if exists
      if (result?.url) {
        URL.revokeObjectURL(result.url);
      }

      const res = await processImageLocally({
        sourceBlob: sourceFile,
        resize,
        crop,
        compression,
        onProgress: (msg) => {
          setProcessingState((prev) => ({ ...prev, progressMessage: msg }));
        },
      });

      setResult(res);
      setProcessingState({
        status: 'success',
        progressMessage: 'Processing completed successfully.',
        error: null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown image processing error.';
      setProcessingState({
        status: 'error',
        progressMessage: '',
        error: msg,
      });
    }
  };

  // Trigger Download
  const handleDownload = () => {
    if (!result || !sourceMeta) return;
    const extension = result.format === 'image/jpeg' ? 'jpg' : result.format === 'image/png' ? 'png' : 'webp';
    const baseName = sourceMeta.name.replace(/\.[^/.]+$/, '');
    const filename = `${baseName}-fileflix.${extension}`;

    const a = document.createElement('a');
    a.href = result.url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Title & Privacy Guarantee Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Image Studio
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Resize, crop, convert, and compress images with 100% in-browser processing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            Zero Server Uploads
          </span>
          {sourceMeta && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset / Change File
            </button>
          )}
        </div>
      </div>

      {/* No file loaded -> Dropzone */}
      {!sourceMeta && (
        <Dropzone
          onImageLoaded={handleImageLoaded}
          isProcessing={processingState.status === 'processing'}
        />
      )}

      {/* File loaded -> Editor Workspace */}
      {sourceMeta && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            {/* Source Info Pill */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
              <div className="flex items-center gap-2 truncate">
                <FileImage className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="font-semibold text-slate-800 truncate">{sourceMeta.name}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 flex-shrink-0">
                <span>{sourceMeta.width}×{sourceMeta.height}</span>
                <span>•</span>
                <span>{formatBytes(sourceMeta.sizeBytes)}</span>
              </div>
            </div>

            {/* Section 1: Resize */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Maximize2 className="w-4 h-4 text-blue-600" />
                  <span>Resize Dimensions</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setResize((prev) => ({
                      ...prev,
                      maintainAspectRatio: !prev.maintainAspectRatio,
                    }))
                  }
                  className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md transition-colors ${
                    resize.maintainAspectRatio
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                  title={resize.maintainAspectRatio ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                >
                  {resize.maintainAspectRatio ? (
                    <>
                      <Lock className="w-3 h-3" /> Locked Ratio
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3 h-3" /> Free Ratio
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-slate-500 font-medium mb-1 block">Width (px)</span>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={resize.width || ''}
                    onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-medium mb-1 block">Height (px)</span>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={resize.height || ''}
                    onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick scale presets */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-xs text-slate-400 mr-1">Scale:</span>
                {[0.25, 0.5, 0.75, 1.0, 1.5, 2.0].map((factor) => (
                  <button
                    key={factor}
                    type="button"
                    onClick={() => applyScalePreset(factor)}
                    className="px-2 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                  >
                    {factor * 100}%
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Section 2: Crop */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Crop className="w-4 h-4 text-indigo-600" />
                  <span>Crop Area</span>
                </label>
                <input
                  type="checkbox"
                  checked={crop.enabled}
                  onChange={(e) => setCrop((prev) => ({ ...prev, enabled: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  id="enable-crop"
                />
              </div>

              {crop.enabled && (
                <div className="p-3 bg-slate-50 rounded-xl space-y-3 text-xs border border-slate-200/80">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 block mb-1">X Offset</span>
                      <input
                        type="number"
                        min="0"
                        value={crop.x}
                        onChange={(e) =>
                          setCrop((prev) => ({ ...prev, x: parseInt(e.target.value) || 0 }))
                        }
                        className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-sm"
                      />
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Y Offset</span>
                      <input
                        type="number"
                        min="0"
                        value={crop.y}
                        onChange={(e) =>
                          setCrop((prev) => ({ ...prev, y: parseInt(e.target.value) || 0 }))
                        }
                        className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 block mb-1">Crop Width</span>
                      <input
                        type="number"
                        min="1"
                        value={crop.width}
                        onChange={(e) =>
                          setCrop((prev) => ({ ...prev, width: parseInt(e.target.value) || 1 }))
                        }
                        className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-sm"
                      />
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Crop Height</span>
                      <input
                        type="number"
                        min="1"
                        value={crop.height}
                        onChange={(e) =>
                          setCrop((prev) => ({ ...prev, height: parseInt(e.target.value) || 1 }))
                        }
                        className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* Section 3: Compression & Format */}
            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <span>Format & Compression</span>
              </label>

              <div>
                <span className="text-xs text-slate-500 font-medium mb-1 block">Output Format</span>
                <select
                  value={compression.format}
                  onChange={(e) =>
                    setCompression((prev) => ({
                      ...prev,
                      format: e.target.value as SupportedOutputFormat,
                    }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="image/jpeg">JPEG (.jpg) — Best for photos & small size</option>
                  <option value="image/webp">WebP (.webp) — Modern, superior compression</option>
                  <option value="image/png">PNG (.png) — Lossless, transparency support</option>
                </select>
              </div>

              {compression.format !== 'image/png' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600">Quality:</span>
                    <span className="text-blue-600 font-bold">
                      {Math.round(compression.quality * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={compression.quality}
                    onChange={(e) =>
                      setCompression((prev) => ({
                        ...prev,
                        quality: parseFloat(e.target.value),
                        targetSizeKb: null, // Clear target size when manually adjusting quality
                      }))
                    }
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>
              )}

              {/* Target Size in KB (Best Effort) */}
              <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Target Max File Size (Optional)
                  </span>
                  {compression.targetSizeKb && (
                    <button
                      type="button"
                      onClick={() => setCompression((prev) => ({ ...prev, targetSizeKb: null }))}
                      className="text-[10px] text-blue-600 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="50000"
                    placeholder="e.g. 50"
                    value={compression.targetSizeKb || ''}
                    onChange={(e) =>
                      setCompression((prev) => ({
                        ...prev,
                        targetSizeKb: parseInt(e.target.value) || null,
                      }))
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-xs font-semibold text-slate-500">KB</span>
                </div>
                {compression.targetSizeKb && (
                  <label className="flex items-start gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compression.allowDimensionReductionForTarget}
                      onChange={(e) =>
                        setCompression((prev) => ({
                          ...prev,
                          allowDimensionReductionForTarget: e.target.checked,
                        }))
                      }
                      className="w-3.5 h-3.5 mt-0.5 text-blue-600 rounded border-slate-300"
                    />
                    <span className="text-[11px] text-slate-500 leading-tight">
                      Allow auto-downscaling dimensions if target size cannot be reached by compression alone
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* Execute Button */}
            <button
              type="button"
              disabled={processingState.status === 'processing'}
              onClick={handleProcess}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {processingState.status === 'processing' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing in Browser...</span>
                </>
              ) : (
                <>
                  <span>Apply & Generate Preview</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Progress / Status Notice */}
            {processingState.progressMessage && (
              <p className="text-xs text-center text-slate-500 animate-fade-in">
                {processingState.progressMessage}
              </p>
            )}

            {processingState.error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{processingState.error}</span>
              </div>
            )}
          </div>

          {/* Preview & Results Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Live Comparison Box */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-slate-800">
                {result ? 'Result & Comparison' : 'Original Preview'}
              </h2>

              {/* Visual Preview */}
              <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center min-h-[300px] max-h-[460px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result ? result.url : sourceMeta.objectUrl}
                  alt={result ? 'Processed Preview' : 'Original Image'}
                  className="max-h-[460px] w-auto object-contain mx-auto"
                />
              </div>

              {/* Comparison Metrics */}
              {result && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                      <span className="text-[11px] text-slate-500 font-medium block">Original Size</span>
                      <span className="text-sm font-bold text-slate-800">
                        {formatBytes(sourceMeta.sizeBytes)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {sourceMeta.width}×{sourceMeta.height} px
                      </span>
                    </div>

                    <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80">
                      <span className="text-[11px] text-blue-600 font-medium block">Transformed Size</span>
                      <span className="text-sm font-bold text-blue-800">
                        {formatBytes(result.sizeBytes)}
                      </span>
                      <span className="text-[10px] text-blue-500 block">
                        {result.width}×{result.height} px
                      </span>
                    </div>

                    <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/80 col-span-2 sm:col-span-1">
                      <span className="text-[11px] text-emerald-700 font-medium block">Size Difference</span>
                      {(() => {
                        const change = calculatePercentageChange(sourceMeta.sizeBytes, result.sizeBytes);
                        return (
                          <span className="text-sm font-bold text-emerald-800">
                            {change.isReduction ? `-${change.percentage}%` : `+${change.percentage}%`}
                          </span>
                        );
                      })()}
                      <span className="text-[10px] text-emerald-600 block">
                        in {result.processingTimeMs} ms
                      </span>
                    </div>
                  </div>

                  {/* Target Size Explanation / Badge */}
                  {result.targetSizeAchieved !== undefined && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                        result.targetSizeAchieved
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}
                    >
                      {result.targetSizeAchieved ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <span className="font-semibold">
                          {result.targetSizeAchieved ? 'Target Size Met' : 'Target Size Note'}
                        </span>
                        <p className="text-[11px] opacity-90 leading-relaxed">
                          {result.targetSizeExplanation ||
                            (result.targetSizeAchieved
                              ? `Successfully compressed under ${compression.targetSizeKb} KB.`
                              : `Target ${compression.targetSizeKb} KB could not be met.`)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Download Action */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex-1 py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Processed Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="py-3 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-medium text-sm transition-colors"
                    >
                      Process Another Image
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
