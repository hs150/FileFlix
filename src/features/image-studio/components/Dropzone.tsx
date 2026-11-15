'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, AlertCircle, FileImage, ShieldCheck } from 'lucide-react';
import { validateImageFile, FileValidationError } from '@/lib/file-validation/file-signatures';
import { ImageMetadata } from '../types';
import { calculateAspectRatio } from '../lib/image-math';

interface DropzoneProps {
  onImageLoaded: (metadata: ImageMetadata, file: File) => void;
  isProcessing: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onImageLoaded, isProcessing }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setValidationError(null);

    try {
      // Validate magic bytes & size
      const { detected } = await validateImageFile(file);

      // Load dimensions
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        const metadata: ImageMetadata = {
          width: img.naturalWidth,
          height: img.naturalHeight,
          sizeBytes: file.size,
          format: detected.mime,
          name: file.name,
          aspectRatio: calculateAspectRatio(img.naturalWidth, img.naturalHeight),
          objectUrl,
        };
        onImageLoaded(metadata, file);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setValidationError('Failed to decode image data. The file may be corrupt.');
      };

      img.src = objectUrl;
    } catch (err: unknown) {
      if (err instanceof FileValidationError) {
        setValidationError(err.message);
      } else if (err instanceof Error) {
        setValidationError(err.message);
      } else {
        setValidationError('An unexpected error occurred while validating the file.');
      }
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
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
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
            ? 'border-blue-500 bg-blue-50/70 scale-[1.01]'
            : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/50 shadow-sm'
        } ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onFileInputChange}
          aria-label="Upload image"
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <UploadCloud className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-800">
              Drag & drop your image here, or <span className="text-blue-600 underline">browse</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Supports JPEG, PNG, WebP, and GIF up to 50 MB
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Files never leave your browser • 100% Client-Side</span>
          </div>
        </div>
      </div>

      {validationError && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Validation Error</p>
            <p className="text-xs text-red-600">{validationError}</p>
          </div>
        </div>
      )}
    </div>
  );
};
