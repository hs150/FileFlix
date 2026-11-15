'use client';

import React, { useState } from 'react';
import { TextExtractionResult } from '../types';
import { extractTextFromPDF } from '../lib/text-extractor';
import {
  FileSearch,
  UploadCloud,
  FileText,
  Copy,
  Check,
  Download,
  RotateCcw,
  AlertTriangle,
  Info,
  ShieldCheck,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export const TextExtractionView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TextExtractionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [activePage, setActivePage] = useState<number>(1);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setResult(null);
    setIsProcessing(true);
    setProgress(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const res = await extractTextFromPDF(buffer, selectedFile.name, (current, total) => {
        setProgress({ current, total });
      });
      setResult(res);
      setActivePage(1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to extract text from PDF document.');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(null);
  };

  const handleCopyAll = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.rawFullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!result || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const blob = new Blob([result.rawFullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}-extracted-fileflix.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Title & Privacy Guarantee Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Text Extraction Studio
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Extract text from digital PDFs page-by-page with 100% in-browser processing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            Zero Server Uploads
          </span>
          {file && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Document
            </button>
          )}
        </div>
      </div>

      {/* Upload Dropzone */}
      {!file && (
        <div className="w-full max-w-2xl mx-auto space-y-4">
          <label className="block border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-3xl p-8 sm:p-12 text-center cursor-pointer bg-white hover:bg-slate-50/50 shadow-sm transition-all">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800">
                  Select a PDF to extract text
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  Processes locally in your browser memory
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Text and files are never transmitted across the network</span>
              </div>
            </div>
          </label>
        </div>
      )}

      {/* Processing Loader */}
      {isProcessing && (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 max-w-xl mx-auto">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            Extracting text in your browser...
          </h3>
          {progress && (
            <p className="text-xs text-slate-500 font-medium">
              Reading Page {progress.current} of {progress.total}
            </p>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2 max-w-2xl mx-auto">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Results View */}
      {result && (
        <div className="space-y-6">
          {/* Summary Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block">Total Pages</span>
              <span className="text-xl font-bold text-slate-900">{result.summary.totalPages}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block">Text Pages</span>
              <span className="text-xl font-bold text-emerald-600">
                {result.summary.textPagesCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block">Total Words</span>
              <span className="text-xl font-bold text-slate-900">{result.summary.totalWords}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block">Processing Time</span>
              <span className="text-xl font-bold text-slate-900">
                {result.processingTimeMs} ms
              </span>
            </div>
          </div>

          {/* Scanned / OCR Notice */}
          {result.summary.requiresOCR && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">Scanned / Image-Based Pages Detected</span>
                <p className="leading-relaxed opacity-95">{result.summary.explanation}</p>
                <p className="text-[11px] opacity-80">
                  Note: Digital text extraction reads embedded fonts. Scanned photos or flattened documents require OCR image recognition, which is not yet enabled for client-side processing.
                </p>
              </div>
            </div>
          )}

          {/* Main Content & Page Browser */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header with Actions */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="font-bold text-slate-800 text-sm truncate">{result.filename}</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Full Text' : 'Copy All Text'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .TXT</span>
                </button>
              </div>
            </div>

            {/* Page Tabs */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-100 overflow-x-auto bg-slate-50/30 text-xs">
              <span className="text-slate-400 font-medium mr-2">Page:</span>
              {result.pages.map((p) => (
                <button
                  key={p.pageNumber}
                  onClick={() => setActivePage(p.pageNumber)}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    activePage === p.pageNumber
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  {p.pageNumber}
                  {p.isImageOnlyOrEmpty && <span className="ml-1 text-[9px] text-amber-300">★</span>}
                </button>
              ))}
            </div>

            {/* Active Page Content */}
            <div className="p-6">
              {(() => {
                const page = result.pages.find((p) => p.pageNumber === activePage);
                if (!page) return null;

                if (page.isImageOnlyOrEmpty) {
                  return (
                    <div className="p-8 text-center space-y-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <FileSearch className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-sm font-semibold text-slate-700">
                        No extractable text on Page {page.pageNumber}
                      </p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        This page contains fewer than 15 characters of embedded text. It is likely a scanned graphic, full-page photo, or empty page.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-100 pb-2">
                      <span>Page {page.pageNumber} Content</span>
                      <span>{page.wordCount} words • {page.characterCount} characters</span>
                    </div>
                    <pre className="p-4 bg-slate-50 rounded-xl text-slate-800 font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed overflow-x-auto border border-slate-100">
                      {page.text}
                    </pre>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
