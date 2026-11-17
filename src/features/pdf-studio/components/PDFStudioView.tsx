'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PDFItem, PDFPageInfo, PDFProcessingResult, PDFStudioMode } from '../types';
import { PDFDropzone } from './PDFDropzone';
import { mergePDFs, transformPDFPages } from '../lib/pdf-processor';
import { PDFThumbnailService } from '../lib/pdf-thumbnail-queue';
import { PDFPageThumbnail } from './PDFPageThumbnail';
import { formatBytes } from '@/features/image-studio/lib/image-math';
import {
  FileText,
  RotateCw,
  RotateCcw,
  Trash2,
  ArrowUp,
  ArrowDown,
  Download,
  Plus,
  RotateCcw as ResetIcon,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  CheckSquare,
  Square,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

export const PDFStudioView: React.FC = () => {
  const [mode, setMode] = useState<PDFStudioMode>('merge');

  // Merge Mode State
  const [mergeItems, setMergeItems] = useState<PDFItem[]>([]);

  // Organize Mode State
  const [organizeItem, setOrganizeItem] = useState<PDFItem | null>(null);
  const [pages, setPages] = useState<PDFPageInfo[]>([]);
  const [thumbnailService, setThumbnailService] = useState<PDFThumbnailService | null>(null);

  // Result & Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PDFProcessingResult | null>(null);

  // Cleanup object URLs and thumbnail service on unmount or reset
  const cleanupResultUrl = useCallback(() => {
    if (result?.url) {
      URL.revokeObjectURL(result.url);
    }
  }, [result]);

  useEffect(() => {
    return () => {
      cleanupResultUrl();
      if (thumbnailService) {
        thumbnailService.destroy();
      }
    };
  }, [cleanupResultUrl, thumbnailService]);

  const handleReset = () => {
    cleanupResultUrl();
    if (thumbnailService) {
      thumbnailService.destroy();
      setThumbnailService(null);
    }
    setMergeItems([]);
    setOrganizeItem(null);
    setPages([]);
    setResult(null);
    setError(null);
  };

  // Switch modes safely
  const switchMode = (newMode: PDFStudioMode) => {
    if (newMode !== mode) {
      handleReset();
      setMode(newMode);
    }
  };

  // Merge handlers
  const handleMergePDFsLoaded = (newItems: PDFItem[]) => {
    setMergeItems((prev) => [...prev, ...newItems]);
    setResult(null);
    setError(null);
  };

  const moveMergeItem = (index: number, direction: 'up' | 'down') => {
    setMergeItems((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const removeMergeItem = (index: number) => {
    setMergeItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExecuteMerge = async () => {
    if (mergeItems.length < 2) {
      setError('Please add at least 2 PDF files to merge.');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      cleanupResultUrl();

      const res = await mergePDFs(
        mergeItems.map((item) => ({ buffer: item.buffer, name: item.name })),
        'merged-document-fileflix.pdf'
      );

      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to merge PDF files.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Organize handlers
  const handleOrganizePDFLoaded = (items: PDFItem[]) => {
    if (items.length > 0) {
      const item = items[0];
      if (thumbnailService) {
        thumbnailService.destroy();
      }
      const service = new PDFThumbnailService(item.buffer.slice(0), item.id);
      setThumbnailService(service);
      setOrganizeItem(item);
      setPages([...item.pages]);
      setResult(null);
      setError(null);
    }
  };

  const removePage = (index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
  };

  const rotatePage = (index: number, delta: 90 | -90) => {
    setPages((prev) => {
      const copy = [...prev];
      const newRotation = (copy[index].rotation + delta + 360) % 360;
      copy[index] = { ...copy[index], rotation: newRotation };
      return copy;
    });
  };

  const rotateAllPages = (delta: 90 | -90) => {
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: (p.rotation + delta + 360) % 360,
      }))
    );
  };

  const togglePageSelection = (index: number) => {
    setPages((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], selected: !copy[index].selected };
      return copy;
    });
  };

  const selectAllPages = (selected: boolean) => {
    setPages((prev) => prev.map((p) => ({ ...p, selected })));
  };

  const movePage = (index: number, direction: 'left' | 'right') => {
    setPages((prev) => {
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleExecuteOrganize = async () => {
    if (!organizeItem) return;

    try {
      setIsProcessing(true);
      setError(null);
      cleanupResultUrl();

      const baseName = organizeItem.name.replace(/\.[^/.]+$/, '');
      const res = await transformPDFPages(
        organizeItem.buffer,
        pages,
        `${baseName}-organized-fileflix.pdf`
      );

      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to transform PDF pages.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Trigger
  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Title & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            PDF Studio
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Merge, split, extract, rotate, and organize PDF documents locally.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            Zero Server Uploads
          </span>
          {(mergeItems.length > 0 || organizeItem) && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              <ResetIcon className="w-3.5 h-3.5" />
              Reset Files
            </button>
          )}
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center p-1 bg-slate-200/60 rounded-xl w-fit">
        <button
          onClick={() => switchMode('merge')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            mode === 'merge'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Merge PDF Files
        </button>
        <button
          onClick={() => switchMode('organize')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            mode === 'organize'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Organize, Rotate & Split
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ================= MODE: MERGE ================= */}
      {mode === 'merge' && (
        <div className="space-y-6">
          {mergeItems.length === 0 ? (
            <PDFDropzone onPDFsLoaded={handleMergePDFsLoaded} multiple={true} isProcessing={isProcessing} />
          ) : (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-800">
                      Files to Merge ({mergeItems.length})
                    </h2>
                    <span className="text-xs text-slate-500 font-medium">
                      (Drag or use arrows to change order)
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 cursor-pointer transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add More PDFs</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const files = Array.from(e.target.files);
                          files.forEach(async (f) => {
                            const buffer = await f.arrayBuffer();
                            const { loadPDFInfo } = await import('../lib/pdf-processor');
                            try {
                              const item = await loadPDFInfo(buffer, f);
                              setMergeItems((prev) => [...prev, item]);
                            } catch (err: unknown) {
                              setError(err instanceof Error ? err.message : 'Invalid PDF');
                            }
                          });
                        }
                      }}
                    />
                  </label>
                </div>

                {/* List of Files */}
                <div className="space-y-2">
                  {mergeItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <FileText className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                        <div className="truncate">
                          <p className="font-semibold text-slate-800 truncate">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            {item.pageCount} pages • {formatBytes(item.sizeBytes)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveMergeItem(idx, 'up')}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          title="Move up"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === mergeItems.length - 1}
                          onClick={() => moveMergeItem(idx, 'down')}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          title="Move down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMergeItem(idx)}
                          className="p-1.5 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors ml-1"
                          title="Remove file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Merge Action Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={isProcessing || mergeItems.length < 2}
                    onClick={handleExecuteMerge}
                    className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Merging and Validating in Browser...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        <span>
                          Merge {mergeItems.length} PDFs (
                          {mergeItems.reduce((acc, it) => acc + it.pageCount, 0)} Total Pages)
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Result Preview & Download */}
              {result && (
                <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        PDF Merge Successful & Verified
                      </h3>
                      <p className="text-xs text-slate-500">
                        Output verified with {result.pageCount} pages • {formatBytes(result.sizeBytes)} • processed in {result.processingTimeMs} ms
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex-1 py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Merged PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="py-3 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-medium text-sm transition-colors"
                    >
                      Start New Operation
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= MODE: ORGANIZE / ROTATE / SPLIT ================= */}
      {mode === 'organize' && (
        <div className="space-y-6">
          {!organizeItem ? (
            <PDFDropzone onPDFsLoaded={handleOrganizePDFLoaded} multiple={false} isProcessing={isProcessing} />
          ) : (
            <div className="space-y-6">
              {/* Document Overview & Action Bar */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    <span className="font-bold text-slate-800 text-sm truncate">
                      {organizeItem.name}
                    </span>
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      ({pages.length} Pages • {formatBytes(organizeItem.sizeBytes)})
                    </span>
                  </div>

                  {/* Bulk Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => rotateAllPages(90)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Rotate All 90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => selectAllPages(true)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Select All</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => selectAllPages(false)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Deselect All</span>
                    </button>
                  </div>
                </div>

                {/* Page Thumbnails / Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pt-2">
                  {pages.map((page, index) => (
                    <div
                      key={`page-${page.originalIndex}-${index}`}
                      className={`relative flex flex-col items-center p-3 rounded-xl border transition-all ${
                        page.selected
                          ? 'border-indigo-500 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-500/20'
                          : 'border-slate-200 bg-slate-100/50 opacity-60'
                      }`}
                    >
                      {/* Checkbox & Order Pill */}
                      <div className="w-full flex items-center justify-between mb-2">
                        <button
                          type="button"
                          onClick={() => togglePageSelection(index)}
                          className="flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer hover:text-indigo-600 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={page.selected}
                            onChange={() => {}}
                            className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span>Page {page.originalIndex + 1}</span>
                        </button>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">
                          #{index + 1}
                        </span>
                      </div>

                      {/* Visual Page Thumbnail with Live Rotation Display */}
                      <div className="relative w-full flex items-center justify-center p-2 bg-slate-50/80 border border-slate-200/80 rounded-lg overflow-hidden my-1 min-h-[155px]">
                        <div
                          className="transition-transform duration-200 shadow-xs rounded flex items-center justify-center"
                          style={{ transform: `rotate(${page.rotation}deg)` }}
                        >
                          <PDFPageThumbnail
                            thumbnailService={thumbnailService}
                            pageNumber={page.originalIndex + 1}
                            pageWidth={page.width}
                            pageHeight={page.height}
                            rotation={page.rotation}
                          />
                        </div>
                      </div>

                      {/* Rotation & Position Controls */}
                      <div className="w-full flex items-center justify-between pt-2 border-t border-slate-200/70 mt-1">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => rotatePage(index, -90)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors"
                            title="Rotate Left 90°"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => rotatePage(index, 90)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors"
                            title="Rotate Right 90°"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-600">
                          {page.rotation}°
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => movePage(index, 'left')}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 transition-colors"
                            title="Move earlier"
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={index === pages.length - 1}
                            onClick={() => movePage(index, 'right')}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 transition-colors"
                            title="Move later"
                          >
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removePage(index)}
                            className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors ml-0.5"
                            title="Remove Page"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Transform Execute Button */}
                <div className="pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isProcessing || pages.filter((p) => p.selected).length === 0}
                    onClick={handleExecuteOrganize}
                    className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing & Validating in Browser...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        <span>
                          Export {pages.filter((p) => p.selected).length} of {pages.length} Pages
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Result Preview & Download */}
              {result && (
                <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Exported PDF Generated & Verified
                      </h3>
                      <p className="text-xs text-slate-500">
                        Output contains {result.pageCount} pages • {formatBytes(result.sizeBytes)} • processed in {result.processingTimeMs} ms
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex-1 py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Organized PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="py-3 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-medium text-sm transition-colors"
                    >
                      Process Another Document
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
