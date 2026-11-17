'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PDFThumbnailService } from '../lib/pdf-thumbnail-queue';
import { ThumbnailResult } from '../types';
import { Loader2, AlertCircle, FileText } from 'lucide-react';

interface PDFPageThumbnailProps {
  thumbnailService: PDFThumbnailService | null;
  pageNumber: number; // 1-based index
  pageWidth?: number;
  pageHeight?: number;
  rotation?: number; // current page rotation (0, 90, 180, 270)
  className?: string;
}

export const PDFPageThumbnail: React.FC<PDFPageThumbnailProps> = ({
  thumbnailService,
  pageNumber,
  pageWidth,
  pageHeight,
  rotation = 0,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumbnail, setThumbnail] = useState<ThumbnailResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Compute estimated aspect ratio for placeholder skeleton
  const isLandscapeBase = (pageWidth || 595) > (pageHeight || 842);
  const isTransposed = rotation === 90 || rotation === 270;
  const isEffectivelyLandscape = isTransposed ? !isLandscapeBase : isLandscapeBase;

  const baseRatio =
    pageWidth && pageHeight && pageHeight > 0
      ? pageWidth / pageHeight
      : isLandscapeBase
      ? 1.414
      : 0.707;

  const effectiveRatio = isTransposed ? 1 / baseRatio : baseRatio;

  useEffect(() => {
    if (!thumbnailService) {
      setThumbnail(null);
      setStatus('idle');
      return;
    }

    // Check if already in cache
    if (thumbnailService.hasCached(pageNumber)) {
      const cached = thumbnailService.getCached(pageNumber);
      if (cached) {
        setThumbnail(cached);
        setStatus('loaded');
        return;
      }
    }

    let isMounted = true;
    let observer: IntersectionObserver | null = null;
    let inProgress = false;

    const startLoading = (priority: number) => {
      if (!isMounted) return;
      inProgress = true;
      setStatus('loading');
      setErrorMsg(null);

      thumbnailService
        .requestThumbnail(pageNumber, priority)
        .then((res) => {
          inProgress = false;
          if (isMounted) {
            setThumbnail(res);
            setStatus('loaded');
          }
        })
        .catch((err) => {
          inProgress = false;
          if (isMounted) {
            console.warn(`Thumbnail failed for page ${pageNumber}:`, err);
            setErrorMsg(err instanceof Error ? err.message : 'Render failed');
            setStatus('error');
          }
        });
    };

    // Use IntersectionObserver for lazy-rendering visible pages first
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (typeof IntersectionObserver !== 'undefined' && containerRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              if (timer) clearTimeout(timer);
              startLoading(1); // high priority for visible pages
              if (observer && containerRef.current) {
                observer.unobserve(containerRef.current);
              }
              break;
            }
          }
        },
        {
          rootMargin: '200px', // trigger shortly before entering viewport
          threshold: 0.01,
        }
      );

      observer.observe(containerRef.current);

      // Headless / immediate fallback: if observer hasn't fired within 400ms, start rendering
      timer = setTimeout(() => {
        if (isMounted && !inProgress) {
          startLoading(0);
        }
      }, 400);
    } else {
      // Fallback: render immediately if IntersectionObserver is unavailable (e.g. Node tests)
      startLoading(0);
    }

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      if (observer) {
        observer.disconnect();
      }
      // Cancel pending task if not completed
      if (inProgress) {
        thumbnailService.cancelThumbnail(pageNumber);
      }
    };
  }, [thumbnailService, pageNumber]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center bg-white rounded shadow-xs overflow-hidden ${className}`}
      style={{
        width: isEffectivelyLandscape ? '140px' : '105px',
        height: isEffectivelyLandscape ? '105px' : '140px',
      }}
    >
      {/* Loading Skeleton */}
      {status === 'loading' && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 animate-pulse text-slate-400 p-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mb-1" />
          <span className="text-[10px] font-semibold text-slate-400">Loading...</span>
        </div>
      )}

      {/* Idle Skeleton (Waiting for scroll into view) */}
      {status === 'idle' && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 text-slate-300 p-2">
          <FileText className="w-6 h-6 opacity-30 mb-1" />
          <span className="text-[9px] font-medium text-slate-400">P.{pageNumber}</span>
        </div>
      )}

      {/* Loaded Actual Page Thumbnail */}
      {status === 'loaded' && thumbnail && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={thumbnail.dataUrl}
          alt={`PDF Page ${pageNumber} Preview`}
          loading="lazy"
          className="w-full h-full object-contain pointer-events-none select-none transition-opacity duration-200"
        />
      )}

      {/* Error Fallback */}
      {status === 'error' && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-red-50/50 border border-red-200 text-red-500 p-2 text-center">
          <AlertCircle className="w-5 h-5 mb-1" />
          <span className="text-[9px] font-semibold">Preview error</span>
          <button
            type="button"
            onClick={() => {
              if (thumbnailService) {
                setStatus('loading');
                thumbnailService.requestThumbnail(pageNumber, 1).then((res) => {
                  setThumbnail(res);
                  setStatus('loaded');
                });
              }
            }}
            className="mt-1 text-[8px] underline text-indigo-600 hover:text-indigo-800"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};
