import { ExtractedPage, ExtractionSummary, TextExtractionResult } from '../types';
import { detectFormatFromHeader } from '@/lib/file-validation/file-signatures';

/**
 * Text Extractor for PDF Documents using pdfjs-dist.
 * Runs completely locally in browser memory or test runtime.
 */
export async function extractTextFromPDF(
  buffer: ArrayBuffer,
  filename: string = 'document.pdf',
  onProgress?: (current: number, total: number) => void
): Promise<TextExtractionResult> {
  const startTime = performance.now();

  const detected = detectFormatFromHeader(buffer);
  if (!detected || detected.mime !== 'application/pdf') {
    throw new Error('Invalid file format. The file header does not match a PDF document.');
  }

  // Dynamically load pdfjs to handle both browser and node/test environments
  let pdfjs: any;
  if (typeof window === 'undefined') {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } else {
    pdfjs = await import('pdfjs-dist');
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
  }

  const data = new Uint8Array(buffer.slice(0));
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  if (numPages === 0) {
    throw new Error('PDF document has zero pages.');
  }

  const extractedPages: ExtractedPage[] = [];
  let totalCharacters = 0;
  let totalWords = 0;
  let emptyOrImagePagesCount = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum, numPages);
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group items into lines based on vertical transform coordinate
    const items = textContent.items as Array<{ str: string; transform: number[] }>;
    let pageText = '';

    if (items.length > 0) {
      // Sort items by Y (descending) and then X (ascending)
      const sortedItems = [...items].sort((a, b) => {
        const yA = a.transform ? a.transform[5] : 0;
        const yB = b.transform ? b.transform[5] : 0;
        if (Math.abs(yA - yB) > 4) {
          return yB - yA; // top to bottom
        }
        const xA = a.transform ? a.transform[4] : 0;
        const xB = b.transform ? b.transform[4] : 0;
        return xA - xB; // left to right
      });

      let lastY: number | null = null;
      const lines: string[] = [];
      let currentLine = '';

      for (const item of sortedItems) {
        const currentY = item.transform ? item.transform[5] : 0;
        if (lastY !== null && Math.abs(currentY - lastY) > 5) {
          if (currentLine.trim()) {
            lines.push(currentLine.trim());
          }
          currentLine = '';
        }
        currentLine += (currentLine ? ' ' : '') + item.str;
        lastY = currentY;
      }

      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }

      pageText = lines.join('\n');
    }

    const trimmed = pageText.trim();
    const charCount = trimmed.length;
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    const wordCount = words.length;

    // A page with fewer than 15 characters is likely image-only or scanned
    const isImageOnlyOrEmpty = charCount < 15;
    if (isImageOnlyOrEmpty) {
      emptyOrImagePagesCount++;
    }

    totalCharacters += charCount;
    totalWords += wordCount;

    extractedPages.push({
      pageNumber: pageNum,
      text: pageText,
      characterCount: charCount,
      wordCount,
      isImageOnlyOrEmpty,
    });
  }

  const textPagesCount = numPages - emptyOrImagePagesCount;
  const requiresOCR = emptyOrImagePagesCount > 0;

  let explanation = 'All pages contain readable digital text.';
  if (emptyOrImagePagesCount === numPages) {
    explanation =
      'This document appears to be entirely scanned or image-based. Optical Character Recognition (OCR) is required to extract text from images.';
  } else if (requiresOCR) {
    explanation = `${emptyOrImagePagesCount} of ${numPages} pages contain little to no digital text and likely require OCR.`;
  }

  const summary: ExtractionSummary = {
    totalPages: numPages,
    textPagesCount,
    emptyOrImagePagesCount,
    totalCharacters,
    totalWords,
    requiresOCR,
    explanation,
  };

  const rawFullText = extractedPages
    .map((p) => `--- Page ${p.pageNumber} ---\n${p.text ? p.text : '[No extractable text found on this page. May be scanned or image-only.]'}\n`)
    .join('\n');

  const processingTimeMs = Math.round(performance.now() - startTime);

  return {
    filename,
    pages: extractedPages,
    summary,
    rawFullText,
    processingTimeMs,
  };
}
