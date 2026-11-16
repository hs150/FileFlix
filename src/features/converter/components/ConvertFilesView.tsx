'use client';

import React, { useState, useRef, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Download,
  RotateCcw,
  Sparkles,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  FolderArchive,
  Layers,
  Settings2,
  Info,
} from 'lucide-react';
import {
  getSupportedConversionsForMime,
  findConversion,
  CONVERSION_CAPABILITY_REGISTRY,
} from '../lib/registry';
import { convertImageLocally } from '../lib/image-converter';
import { convertImagesToPdf } from '../lib/image-to-pdf';
import { convertPdfToImages } from '../lib/pdf-to-image';
import { detectFormatFromHeader, DetectedFormat } from '@/lib/file-validation/file-signatures';
import {
  ConversionDefinition,
  PageSizeOption,
  PageOrientationOption,
  PageMarginOption,
  ConvertedPageResult,
} from '../types';

interface UploadedFileItem {
  file: File;
  name: string;
  sizeBytes: number;
  detectedFormat: DetectedFormat | null;
  previewUrl?: string;
}

export default function ConvertFilesView() {
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [selectedTargetMime, setSelectedTargetMime] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Image Conversion Options
  const [imageQuality, setImageQuality] = useState<number>(0.92);

  // Image -> PDF Options
  const [pageSize, setPageSize] = useState<PageSizeOption>('a4');
  const [pageOrientation, setPageOrientation] = useState<PageOrientationOption>('auto');
  const [pageMargin, setPageMargin] = useState<PageMarginOption>('small');

  // PDF -> Image Options
  const [pdfScale, setPdfScale] = useState<1 | 2>(2);
  const [pdfQuality, setPdfQuality] = useState<number>(0.92);
  const [pdfPageSelection, setPdfPageSelection] = useState<'all' | 'custom'>('all');
  const [pdfCustomPages, setPdfCustomPages] = useState<string>('');

  // Results State
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string>('');
  const [resultMime, setResultMime] = useState<string>('');
  const [resultSizeBytes, setResultSizeBytes] = useState<number>(0);
  const [processingTimeMs, setProcessingTimeMs] = useState<number>(0);
  const [resultWarnings, setResultWarnings] = useState<string[]>([]);
  const [pdfRenderedPages, setPdfRenderedPages] = useState<ConvertedPageResult[]>([]);
  const [pdfZipUrl, setPdfZipUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute available target formats based on the primary file
  const primaryFile = files[0];
  const primaryMime = primaryFile?.detectedFormat?.mime || '';
  const availableConversions: ConversionDefinition[] = primaryMime
    ? getSupportedConversionsForMime(primaryMime)
    : [];

  const currentConversionDef = findConversion(primaryMime, selectedTargetMime);

  // Handle File Input Selection
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    resetResults();
    setErrorMessage(null);

    const items: UploadedFileItem[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const f = selectedFiles[i];
      try {
        const headerBuf = await f.slice(0, 32).arrayBuffer();
        const detected = detectFormatFromHeader(headerBuf);

        let previewUrl: string | undefined = undefined;
        if (f.type.startsWith('image/') || (detected && detected.mime.startsWith('image/'))) {
          previewUrl = URL.createObjectURL(f);
        }

        items.push({
          file: f,
          name: f.name,
          sizeBytes: f.size,
          detectedFormat: detected,
          previewUrl,
        });
      } catch (err) {
        console.error('File inspection failed:', err);
      }
    }

    if (items.length > 0) {
      setFiles(items);
      const firstDetectedMime = items[0].detectedFormat?.mime || '';
      const available = getSupportedConversionsForMime(firstDetectedMime);
      if (available.length > 0) {
        setSelectedTargetMime(available[0].outputMime);
      } else {
        setSelectedTargetMime('');
      }

      if (!items[0].detectedFormat) {
        setErrorMessage(
          'File content validation failed. The file header does not match any recognized image or PDF signature.'
        );
      }
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (fileInputRef.current) {
        fileInputRef.current.files = e.dataTransfer.files;
        const changeEvent = new Event('change', { bubbles: true });
        fileInputRef.current.dispatchEvent(changeEvent);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const resetResults = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    if (pdfZipUrl) URL.revokeObjectURL(pdfZipUrl);
    pdfRenderedPages.forEach((p) => URL.revokeObjectURL(p.url));

    setResultBlob(null);
    setResultUrl(null);
    setResultFilename('');
    setResultMime('');
    setResultSizeBytes(0);
    setProcessingTimeMs(0);
    setResultWarnings([]);
    setPdfRenderedPages([]);
    setPdfZipUrl(null);
    setProgressMessage('');
  };

  const handleFullReset = () => {
    resetResults();
    files.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setFiles([]);
    setSelectedTargetMime('');
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Perform Conversion
  const handleExecuteConversion = async () => {
    if (!primaryFile || !primaryFile.detectedFormat || !selectedTargetMime) return;

    setIsProcessing(true);
    setErrorMessage(null);
    resetResults();

    try {
      const inputMime = primaryFile.detectedFormat.mime;
      const targetMime = selectedTargetMime;

      // 1. Image -> Image Conversion
      if (inputMime.startsWith('image/') && targetMime.startsWith('image/')) {
        setProgressMessage(`Converting image to ${targetMime}...`);
        const res = await convertImageLocally(primaryFile.file, {
          targetFormat: targetMime as 'image/jpeg' | 'image/png' | 'image/webp',
          quality: imageQuality,
          backgroundColor: '#ffffff',
        });

        const ext = targetMime === 'image/jpeg' ? 'jpg' : targetMime === 'image/png' ? 'png' : 'webp';
        const nameWithoutExt = primaryFile.name.replace(/\.[^/.]+$/, '');
        const filename = `${nameWithoutExt}-converted.${ext}`;

        setResultBlob(res.blob);
        setResultUrl(res.url);
        setResultFilename(filename);
        setResultMime(targetMime);
        setResultSizeBytes(res.sizeBytes);
        setProcessingTimeMs(res.processingTimeMs);
        setResultWarnings(res.warnings);
      }
      // 2. Image(s) -> PDF Conversion
      else if (inputMime.startsWith('image/') && targetMime === 'application/pdf') {
        setProgressMessage('Composing PDF pages from images...');
        const imageItems = files.map((f) => ({
          blob: f.file,
          name: f.name,
        }));

        const nameWithoutExt = primaryFile.name.replace(/\.[^/.]+$/, '');
        const filename = files.length > 1 ? `converted-album.pdf` : `${nameWithoutExt}.pdf`;

        const res = await convertImagesToPdf(
          imageItems,
          {
            pageSize,
            orientation: pageOrientation,
            margin: pageMargin,
          },
          filename
        );

        setResultBlob(res.blob);
        setResultUrl(res.url);
        setResultFilename(res.filename);
        setResultMime('application/pdf');
        setResultSizeBytes(res.sizeBytes);
        setProcessingTimeMs(res.processingTimeMs);
        setResultWarnings(res.warnings);
      }
      // 3. PDF -> Image(s) Conversion
      else if (inputMime === 'application/pdf' && targetMime.startsWith('image/')) {
        setProgressMessage('Rendering PDF pages in browser memory...');
        const pdfBuffer = await primaryFile.file.arrayBuffer();

        let pagesToRender: number[] | undefined = undefined;
        if (pdfPageSelection === 'custom' && pdfCustomPages.trim()) {
          pagesToRender = pdfCustomPages
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n) && n > 0);
        }

        const res = await convertPdfToImages(
          pdfBuffer,
          {
            targetFormat: targetMime as 'image/jpeg' | 'image/png',
            scale: pdfScale,
            quality: pdfQuality,
            pages: pagesToRender,
          },
          primaryFile.name,
          (cur, total) => setProgressMessage(`Rendering page ${cur} of ${total}...`)
        );

        setPdfRenderedPages(res.pages);
        if (res.zipBlob && res.zipUrl) {
          setPdfZipUrl(res.zipUrl);
        }

        if (res.pages.length === 1) {
          const single = res.pages[0];
          setResultBlob(single.blob);
          setResultUrl(single.url);
          setResultFilename(single.filename);
          setResultMime(targetMime);
          setResultSizeBytes(single.sizeBytes);
        } else if (res.zipBlob && res.zipUrl) {
          const nameWithoutExt = primaryFile.name.replace(/\.pdf$/i, '');
          setResultBlob(res.zipBlob);
          setResultUrl(res.zipUrl);
          setResultFilename(`${nameWithoutExt}-pages.zip`);
          setResultMime('application/zip');
          setResultSizeBytes(res.zipBlob.size);
        }

        setProcessingTimeMs(res.processingTimeMs);
        setResultWarnings(res.warnings);
      } else {
        throw new Error(`Conversion from ${inputMime} to ${targetMime} is not supported locally.`);
      }
    } catch (err: unknown) {
      console.error('Conversion error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Conversion failed.');
    } finally {
      setIsProcessing(false);
      setProgressMessage('');
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Multi-Format File Conversion Hub</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Convert files locally with <span className="text-blue-600">zero server uploads</span>.
        </h1>
        <p className="text-slate-600 max-w-2xl mx-auto text-sm sm:text-base">
          Transform images, PDFs, and documents directly inside your browser. No file size tracking, no rate limits,
          and zero remote data transfer.
        </p>
      </div>

      {/* Upload Dropzone */}
      {files.length === 0 && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/20 rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 shadow-sm"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
          />
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">
            Drop images or PDF document here, or browse
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-4">
            Supports JPEG, PNG, WebP, and PDF. Select single files or multiple images to compile into a PDF.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
            Choose File(s)
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Validation Error</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* File Loaded & Configuration Panel */}
      {files.length > 0 && primaryFile && (
        <div className="space-y-6">
          {/* File Overview Card */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                {primaryMime === 'application/pdf' ? (
                  <FileText className="w-6 h-6" />
                ) : (
                  <ImageIcon className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">{primaryFile.name}</h3>
                  {files.length > 1 && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                      +{files.length - 1} more file(s)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span>
                    Detected: <strong className="text-slate-700">{primaryFile.detectedFormat?.description || 'Unknown'}</strong>
                  </span>
                  <span>•</span>
                  <span>{(primaryFile.sizeBytes / 1024).toFixed(1)} KB</span>
                  <span>•</span>
                  <span className="text-emerald-600 font-medium">Magic Bytes Verified</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleFullReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset & Choose Another
            </button>
          </div>

          {/* Conversion Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Target Selection */}
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
                <ArrowRight className="w-5 h-5 text-blue-600" />
                <span>Select Target Format</span>
              </div>

              {availableConversions.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 text-amber-800 text-xs">
                  No verified browser-local conversions available for this format ({primaryMime}).
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">Convert To:</label>
                  <select
                    value={selectedTargetMime}
                    onChange={(e) => {
                      resetResults();
                      setSelectedTargetMime(e.target.value);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {availableConversions.map((conv) => (
                      <option key={conv.id} value={conv.outputMime}>
                        {conv.name} ({conv.outputExtension.toUpperCase()})
                      </option>
                    ))}
                  </select>

                  {/* Conversion Details Card */}
                  {currentConversionDef && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          {currentConversionDef.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold ${
                            currentConversionDef.preservesLossless
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {currentConversionDef.preservesLossless ? 'Lossless Output' : 'Lossy Output'}
                        </span>
                      </div>
                      <p className="text-slate-600">{currentConversionDef.description}</p>
                      <div className="text-slate-500 pt-1">
                        <strong>Engine:</strong> {currentConversionDef.engine}
                      </div>
                      <div className="text-slate-500">
                        <strong>Limitations:</strong> {currentConversionDef.knownLimitations[0]}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Specific Conversion Options */}
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
                <Settings2 className="w-5 h-5 text-blue-600" />
                <span>Conversion Settings</span>
              </div>

              {/* 1. Options for Image -> Image */}
              {primaryMime.startsWith('image/') && selectedTargetMime.startsWith('image/') && (
                <div className="space-y-4">
                  {selectedTargetMime !== 'image/png' ? (
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                        <span>Quality</span>
                        <span>{Math.round(imageQuality * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="1.0"
                        step="0.05"
                        value={imageQuality}
                        onChange={(e) => setImageQuality(parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        Higher quality preserves sharper details but increases output file size.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-blue-50 text-blue-800 rounded-xl text-xs flex items-start gap-2">
                      <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Lossless PNG:</strong> Quality slider is disabled because PNG uses lossless Deflate compression without discarding pixel data.
                      </div>
                    </div>
                  )}

                  {selectedTargetMime === 'image/jpeg' && (
                    <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Transparency Notice:</strong> JPEG does not support alpha channels. Transparent pixels will be flattened to solid white (#ffffff).
                      </div>
                    </div>
                  )}

                  {primaryMime === 'image/jpeg' && selectedTargetMime === 'image/png' && (
                    <div className="p-3 bg-slate-100 text-slate-700 rounded-xl text-xs flex items-start gap-2">
                      <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Lossless Note:</strong> Converting JPEG to PNG prevents further loss during edits, but does not restore frequencies discarded when the JPEG was originally created.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Options for Image(s) -> PDF */}
              {primaryMime.startsWith('image/') && selectedTargetMime === 'application/pdf' && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Page Size</label>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(e.target.value as PageSizeOption)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="a4">A4 (595 × 842 pt)</option>
                      <option value="letter">US Letter (612 × 792 pt)</option>
                      <option value="fit-image">Fit Page to Image Dimensions</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Orientation</label>
                    <select
                      value={pageOrientation}
                      onChange={(e) => setPageOrientation(e.target.value as PageOrientationOption)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      disabled={pageSize === 'fit-image'}
                    >
                      <option value="auto">Auto (Match Image Ratio)</option>
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Margin</label>
                    <select
                      value={pageMargin}
                      onChange={(e) => setPageMargin(e.target.value as PageMarginOption)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="none">None (0 pt)</option>
                      <option value="small">Small (18 pt / 0.25 in)</option>
                      <option value="normal">Normal (36 pt / 0.5 in)</option>
                    </select>
                  </div>

                  <p className="text-slate-400">
                    Aspect ratio is strictly preserved. Images are never stretched or distorted.
                  </p>
                </div>
              )}

              {/* 3. Options for PDF -> Image(s) */}
              {primaryMime === 'application/pdf' && selectedTargetMime.startsWith('image/') && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Render Resolution (Scale)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPdfScale(1)}
                        className={`py-2 px-3 rounded-lg border font-semibold ${
                          pdfScale === 1
                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        1x Standard (72/96 DPI)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfScale(2)}
                        className={`py-2 px-3 rounded-lg border font-semibold ${
                          pdfScale === 2
                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        2x High-DPI (Crisp)
                      </button>
                    </div>
                  </div>

                  {selectedTargetMime === 'image/jpeg' && (
                    <div>
                      <div className="flex items-center justify-between font-semibold text-slate-700 mb-1">
                        <span>JPEG Quality</span>
                        <span>{Math.round(pdfQuality * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.3"
                        max="1.0"
                        step="0.05"
                        value={pdfQuality}
                        onChange={(e) => setPdfQuality(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Pages to Convert</label>
                    <div className="flex items-center gap-4 mb-2">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="pdfPages"
                          checked={pdfPageSelection === 'all'}
                          onChange={() => setPdfPageSelection('all')}
                        />
                        <span>All Pages</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="pdfPages"
                          checked={pdfPageSelection === 'custom'}
                          onChange={() => setPdfPageSelection('custom')}
                        />
                        <span>Specific Page(s)</span>
                      </label>
                    </div>

                    {pdfPageSelection === 'custom' && (
                      <input
                        type="text"
                        placeholder="e.g. 1, 2, 3"
                        value={pdfCustomPages}
                        onChange={(e) => setPdfCustomPages(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-800"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleExecuteConversion}
                disabled={isProcessing || !selectedTargetMime}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isProcessing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>{progressMessage || 'Processing in Browser...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Execute Conversion</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Card */}
          {(resultUrl || pdfRenderedPages.length > 0) && (
            <div className="p-6 bg-white rounded-2xl border border-emerald-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-lg">
                  <CheckCircle2 className="w-6 h-6" />
                  <span>Conversion Complete</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
                  <span>Processing Time: {processingTimeMs}ms</span>
                  <span>•</span>
                  <span>100% In-Browser</span>
                </div>
              </div>

              {/* Comparison Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Input Format</span>
                  <strong className="text-slate-800 text-sm">{primaryFile.detectedFormat?.extension.toUpperCase()}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Input Size</span>
                  <strong className="text-slate-800 text-sm">{(primaryFile.sizeBytes / 1024).toFixed(1)} KB</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Output Format</span>
                  <strong className="text-slate-800 text-sm">
                    {resultMime === 'application/pdf'
                      ? 'PDF'
                      : resultMime === 'application/zip'
                      ? 'ZIP'
                      : resultMime.replace('image/', '').toUpperCase()}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Output Size</span>
                  <strong className="text-slate-800 text-sm">{(resultSizeBytes / 1024).toFixed(1)} KB</strong>
                </div>
              </div>

              {/* Warnings List if any */}
              {resultWarnings.length > 0 && (
                <div className="space-y-1">
                  {resultWarnings.map((w, idx) => (
                    <div key={idx} className="p-3 bg-amber-50 text-amber-900 rounded-xl text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Single File Download */}
              {resultUrl && !pdfZipUrl && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-blue-50/50 rounded-xl border border-blue-200">
                  <div className="text-sm">
                    <p className="font-bold text-slate-900">{resultFilename}</p>
                    <p className="text-xs text-slate-500">{(resultSizeBytes / 1024).toFixed(1)} KB</p>
                  </div>
                  <a
                    href={resultUrl}
                    download={resultFilename}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Converted File</span>
                  </a>
                </div>
              )}

              {/* Multi-Page PDF Download (ZIP and Individual Pages) */}
              {pdfRenderedPages.length > 1 && (
                <div className="space-y-4">
                  {pdfZipUrl && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                      <div>
                        <p className="font-bold text-emerald-950">Download All {pdfRenderedPages.length} Pages</p>
                        <p className="text-xs text-emerald-700">Bundled into standard ZIP archive ({(resultSizeBytes / 1024).toFixed(1)} KB)</p>
                      </div>
                      <a
                        href={pdfZipUrl}
                        download={resultFilename || 'extracted-pages.zip'}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors shadow-sm"
                      >
                        <FolderArchive className="w-4 h-4" />
                        <span>Download ZIP Archive</span>
                      </a>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-700">Or Download Individual Pages:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {pdfRenderedPages.map((page) => (
                        <div key={page.pageNumber} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                          <div className="text-xs">
                            <span className="font-bold text-slate-800">Page {page.pageNumber}</span>
                            <span className="text-slate-500 block">{(page.sizeBytes / 1024).toFixed(1)} KB</span>
                          </div>
                          <a
                            href={page.url}
                            download={page.filename}
                            className="p-2 rounded-lg bg-white hover:bg-blue-50 text-blue-600 border border-slate-200 hover:border-blue-400 transition-colors"
                            title={`Download ${page.filename}`}
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Central Capability Registry Section */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-slate-700" />
            <h3 className="font-bold text-slate-900 text-base">FileFix Conversion Capability Registry</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">Single Source of Truth</span>
        </div>
        <p className="text-xs text-slate-600">
          FileFix enforces strict transparency: we never claim universal any-to-any conversion or simply rename file extensions.
          Every supported format conversion executes authentic canvas or document graph transformation.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Conversion</th>
                <th className="py-2.5 px-3">Engine</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Primary Limitation / Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {CONVERSION_CAPABILITY_REGISTRY.map((conv) => (
                <tr key={conv.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    {conv.inputExtension.toUpperCase()} &rarr; {conv.outputExtension.toUpperCase()}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">{conv.engine}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        conv.preservesLossless ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {conv.preservesLossless ? 'Lossless' : 'Lossy'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        conv.verificationStatus === 'VERIFIED_LOCAL'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {conv.verificationStatus === 'VERIFIED_LOCAL' ? 'Verified Local' : 'Researched (P3/P4)'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate" title={conv.knownLimitations[0]}>
                    {conv.knownLimitations[0]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
