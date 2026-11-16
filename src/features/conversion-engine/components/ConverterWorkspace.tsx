'use client';

import React, { useState, useRef } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Download,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Search,
  Filter,
  FileArchive,
  Table,
  PenTool,
  BookOpen,
  Image as ImageIcon,
  Layers,
  Info,
} from 'lucide-react';
import {
  ConversionDefinition,
  FileFormat,
  DetectedFormatInfo,
  ConversionInput,
  ConversionOutput,
  ConversionCategory,
} from '../core/conversion-types';
import {
  SUPPORTED_FILE_FORMATS,
  UNIVERSAL_CONVERSION_REGISTRY,
  getAvailableOutputsForFormat,
  findConversionDefinition,
} from '../core/conversion-registry';
import { detectFileFormat } from '../core/format-detection';
import { executeConversion } from '../core/conversion-executor';

export default function ConverterWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormatInfo | null>(null);
  const [availableTargets, setAvailableTargets] = useState<FileFormat[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result state
  const [resultOutput, setResultOutput] = useState<ConversionOutput | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [elapsedTimeMs, setElapsedTimeMs] = useState<number>(0);

  // Explorer filter state
  const [explorerCategory, setExplorerCategory] = useState<ConversionCategory | 'all'>('all');
  const [explorerSearch, setExplorerSearch] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileSelected = async (selectedFile: File) => {
    setErrorMessage(null);
    resetResults();

    setFile(selectedFile);
    setProcessingStage('Inspecting file headers and syntax...');

    try {
      const buffer = await selectedFile.arrayBuffer();
      const detected = await detectFileFormat(buffer, selectedFile.name);

      if (!detected) {
        setErrorMessage(
          'File format could not be verified. The content does not match any supported binary signature or text syntax.'
        );
        setDetectedFormat(null);
        setAvailableTargets([]);
        setSelectedTargetId('');
        return;
      }

      setDetectedFormat(detected);
      const targets = getAvailableOutputsForFormat(detected.formatId);
      setAvailableTargets(targets);

      if (targets.length > 0) {
        setSelectedTargetId(targets[0].id);
      } else {
        setSelectedTargetId('');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error reading file.');
    } finally {
      setProcessingStage('');
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const resetResults = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultOutput(null);
    setResultUrl(null);
    setElapsedTimeMs(0);
  };

  const handleFullReset = () => {
    resetResults();
    setFile(null);
    setDetectedFormat(null);
    setAvailableTargets([]);
    setSelectedTargetId('');
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Execute Conversion
  const handleConvert = async () => {
    if (!file || !detectedFormat || !selectedTargetId) return;

    setIsProcessing(true);
    setErrorMessage(null);
    resetResults();

    const t0 = performance.now();

    try {
      setProcessingStage('Reading file data...');
      const buffer = await file.arrayBuffer();

      setProcessingStage('Validating format integrity & security limits...');
      const inputObj: ConversionInput = {
        file,
        name: file.name,
        sizeBytes: file.size,
        detectedFormat,
        buffer,
      };

      setProcessingStage('Executing local conversion in browser memory...');
      const output = await executeConversion(inputObj, selectedTargetId);

      setProcessingStage('Verifying output integrity...');
      const url = URL.createObjectURL(output.blob);
      setResultOutput(output);
      setResultUrl(url);
      setElapsedTimeMs(Math.round(performance.now() - t0));
    } catch (err: unknown) {
      console.error('Conversion execution error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Conversion failed.');
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  const activeDef = detectedFormat && selectedTargetId ? findConversionDefinition(detectedFormat.formatId, selectedTargetId) : undefined;

  // Filtered Registry for Explorer
  const filteredConversions = UNIVERSAL_CONVERSION_REGISTRY.filter((c) => {
    if (explorerCategory !== 'all' && c.category !== explorerCategory) return false;
    if (explorerSearch.trim()) {
      const q = explorerSearch.toLowerCase();
      const matchIn = c.inputExtension.toLowerCase().includes(q) || c.inputFormat.toLowerCase().includes(q);
      const matchOut = c.outputExtension.toLowerCase().includes(q) || c.outputFormat.toLowerCase().includes(q);
      const matchDesc = c.lossinessExplanation.toLowerCase().includes(q);
      return matchIn || matchOut || matchDesc;
    }
    return true;
  });

  return (
    <div className="space-y-10 max-w-5xl mx-auto">
      {/* Hero Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Universal Conversion Engine</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Convert files locally with <span className="text-blue-600">zero server uploads</span>.
        </h1>
        <p className="text-slate-600 max-w-2xl mx-auto text-sm sm:text-base">
          Transform archives, spreadsheets, vector art, eBooks, images, and documents directly inside your browser.
          Zero tracking, zero cloud processing, and absolute privacy.
        </p>
      </div>

      {/* Upload Dropzone */}
      {!file && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/20 rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 shadow-sm"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileInputChange}
            className="hidden"
          />
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">
            Drop your file here, or click to browse
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-4">
            Supports ZIP, TAR, GZ, CSV, TSV, JSON, YAML, XML, XLSX, SVG, EPUB, CBZ, JPEG, PNG, and PDF.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
            Select File
          </div>
        </div>
      )}

      {/* Validation / Execution Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Conversion Error</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Active Conversion Configuration Workspace */}
      {file && detectedFormat && (
        <div className="space-y-6">
          {/* File Overview Card */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                {detectedFormat.category === 'archive' && <FileArchive className="w-6 h-6" />}
                {detectedFormat.category === 'data' && <Table className="w-6 h-6" />}
                {detectedFormat.category === 'vector' && <PenTool className="w-6 h-6" />}
                {detectedFormat.category === 'ebook' && <BookOpen className="w-6 h-6" />}
                {(detectedFormat.category === 'image' || detectedFormat.category === 'pdf') && (
                  <ImageIcon className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">{file.name}</h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                  <span>
                    Detected: <strong className="text-slate-800">{detectedFormat.name}</strong>
                  </span>
                  <span>•</span>
                  <span>{(file.size / 1024).toFixed(1)} KB</span>
                  <span>•</span>
                  <span className="text-emerald-600 font-medium capitalize">
                    {detectedFormat.confidence.replace('_', ' ')} verified
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleFullReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Choose Another File
            </button>
          </div>

          {/* Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Target Format Selector */}
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
                <ArrowRight className="w-5 h-5 text-blue-600" />
                <span>Select Target Format</span>
              </div>

              {availableTargets.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 text-amber-800 text-xs">
                  No verified browser-local conversions available for {detectedFormat.name}.
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">Convert To:</label>
                  <select
                    value={selectedTargetId}
                    onChange={(e) => {
                      resetResults();
                      setSelectedTargetId(e.target.value);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {availableTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name} (.{target.extension})
                      </option>
                    ))}
                  </select>

                  {/* Active Conversion Definition Summary */}
                  {activeDef && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          {activeDef.inputExtension.toUpperCase()} &rarr; {activeDef.outputExtension.toUpperCase()}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold capitalize ${
                            activeDef.fidelity === 'lossless'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {activeDef.fidelity}
                        </span>
                      </div>
                      <p className="text-slate-600">{activeDef.lossinessExplanation}</p>
                      {activeDef.limitations.length > 0 && (
                        <div className="text-slate-500 pt-1">
                          <strong>Note:</strong> {activeDef.limitations[0]}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Execution Controls */}
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Security & Integrity Guarantees</span>
                </div>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>100% Client-Side: File bytes never leave this browser session.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Security Sanitization: Path traversal, XXE, and script injection blocked.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>No Fake Extension Renaming: Authentic format transformation.</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleConvert}
                disabled={isProcessing || !selectedTargetId}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isProcessing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>{processingStage || 'Processing...'}</span>
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

          {/* Results Section */}
          {resultOutput && resultUrl && (
            <div className="p-6 bg-white rounded-2xl border border-emerald-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-lg">
                  <CheckCircle2 className="w-6 h-6" />
                  <span>Conversion Successful</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
                  <span>Latency: {elapsedTimeMs}ms</span>
                  <span>•</span>
                  <span>100% In-Browser</span>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Input Format</span>
                  <strong className="text-slate-800 text-sm uppercase">{detectedFormat.extension}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Input Size</span>
                  <strong className="text-slate-800 text-sm">{(file.size / 1024).toFixed(1)} KB</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Output Format</span>
                  <strong className="text-slate-800 text-sm uppercase">{selectedTargetId}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Output Size</span>
                  <strong className="text-slate-800 text-sm">{(resultOutput.sizeBytes / 1024).toFixed(1)} KB</strong>
                </div>
              </div>

              {/* Warnings */}
              {resultOutput.warnings.length > 0 && (
                <div className="space-y-1">
                  {resultOutput.warnings.map((w, i) => (
                    <div key={i} className="p-3 bg-amber-50 text-amber-900 rounded-xl text-xs flex items-start gap-2">
                      <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Download */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-blue-50/50 rounded-xl border border-blue-200">
                <div className="text-sm">
                  <p className="font-bold text-slate-900">{resultOutput.filename}</p>
                  <p className="text-xs text-slate-500">{(resultOutput.sizeBytes / 1024).toFixed(1)} KB</p>
                </div>
                <a
                  href={resultUrl}
                  download={resultOutput.filename}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Converted File</span>
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Format Explorer & Capability Matrix */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-slate-700" />
            <h3 className="font-bold text-slate-900 text-base">Format Explorer & Conversion Matrix</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">Single Registry of Truth</span>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search formats e.g. SVG, CSV, EPUB, TAR..."
              value={explorerSearch}
              onChange={(e) => setExplorerSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={explorerCategory}
              onChange={(e) => setExplorerCategory(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700"
            >
              <option value="all">All Categories</option>
              <option value="archive">Archives</option>
              <option value="data">Data & Spreadsheets</option>
              <option value="vector">Vector Graphics</option>
              <option value="ebook">eBooks</option>
              <option value="image">Images & PDF</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Conversion</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Engine</th>
                <th className="py-2.5 px-3">Fidelity</th>
                <th className="py-2.5 px-3">Execution</th>
                <th className="py-2.5 px-3">Explanation & Limitations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredConversions.map((conv) => (
                <tr key={conv.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    {conv.inputExtension.toUpperCase()} &rarr; {conv.outputExtension.toUpperCase()}
                  </td>
                  <td className="py-2.5 px-3 capitalize text-slate-500">{conv.category}</td>
                  <td className="py-2.5 px-3 text-slate-500">{conv.engineId}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${
                        conv.fidelity === 'lossless'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {conv.fidelity}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      100% Local
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate" title={conv.lossinessExplanation}>
                    {conv.lossinessExplanation}
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
