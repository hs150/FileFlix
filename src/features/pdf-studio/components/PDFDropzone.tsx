'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, AlertCircle, ShieldCheck, FileText } from 'lucide-react';
import { loadPDFInfo, PDFProcessingError } from '../lib/pdf-processor';
import { PDFItem } from '../types';

interface PDFDropzoneProps {
  onPDFsLoaded: (items: PDFItem[]) => void;
  multiple: boolean;
  isProcessing: boolean;
}

export const PDFDropzone: React.FC<PDFDropzoneProps> = ({ onPDFsLoaded, multiple, isProcessing }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (fileList: FileList | File[]) => {
    setErrorMessage(null);
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const loadedItems: PDFItem[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const item = await loadPDFInfo(buffer, file);
        loadedItems.push(item);
      } catch (err: unknown) {
        if (err instanceof PDFProcessingError) {
          errors.push(`${file.name}: ${err.message}`);
        } else if (err instanceof Error) {
          errors.push(`${file.name}: ${err.message}`);
        } else {
          errors.push(`${file.name}: Failed to read file.`);
        }
      }
    }

    if (errors.length > 0) {
      setErrorMessage(errors.join(' | '));
    }

    if (loadedItems.length > 0) {
      onPDFsLoaded(loadedItems);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/70 scale-[1.01]'
            : 'border-slate-300 hover:border-indigo-400 bg-white hover:bg-slate-50/50 shadow-sm'
        } ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple={multiple}
          className="hidden"
          onChange={onFileInputChange}
          aria-label="Upload PDF files"
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <UploadCloud className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-800">
              {multiple
                ? 'Drop PDF files here to merge, or click to browse'
                : 'Drop your PDF here to organize, rotate or split'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Processes locally in your browser with zero server uploads
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>100% In-Browser Privacy • Safe & Instant</span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">PDF Validation Notice</p>
            <p className="text-xs text-red-600">{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};
