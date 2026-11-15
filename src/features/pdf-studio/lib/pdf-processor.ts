import { PDFDocument, degrees } from 'pdf-lib';
import { PDFItem, PDFPageInfo, PDFProcessingResult } from '../types';
import { detectFormatFromHeader } from '@/lib/file-validation/file-signatures';

export class PDFProcessingError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'PDFProcessingError';
  }
}

/**
 * Loads a PDF from ArrayBuffer and inspects its metadata, page count, and encryption status.
 */
export async function loadPDFInfo(buffer: ArrayBuffer, file: File): Promise<PDFItem> {
  const detected = detectFormatFromHeader(buffer);
  if (!detected || detected.mime !== 'application/pdf') {
    throw new PDFProcessingError(
      'Invalid file format. The file header does not match a valid PDF document.',
      'INVALID_PDF_HEADER'
    );
  }

  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: false });
    const pageCount = pdfDoc.getPageCount();

    if (pageCount === 0) {
      throw new PDFProcessingError('PDF document contains no pages.', 'EMPTY_PDF');
    }

    const pages: PDFPageInfo[] = [];
    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i);
      const rotationAngle = page.getRotation().angle;
      pages.push({
        pageNumber: i + 1,
        originalIndex: i,
        rotation: rotationAngle % 360,
        selected: true,
      });
    }

    return {
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      name: file.name,
      sizeBytes: file.size,
      pageCount,
      buffer,
      isEncrypted: false,
      pages,
    };
  } catch (err: unknown) {
    const errorStr = String(err);
    if (errorStr.toLowerCase().includes('encrypt') || errorStr.toLowerCase().includes('password')) {
      throw new PDFProcessingError(
        'This PDF document is encrypted or password-protected. FileFix does not bypass encryption to protect document security.',
        'ENCRYPTED_PDF'
      );
    }
    throw new PDFProcessingError(
      `Failed to parse PDF document: ${err instanceof Error ? err.message : 'Corrupt structure.'}`,
      'PARSE_ERROR'
    );
  }
}

/**
 * Merges multiple PDF documents into a single PDF.
 * Validates output by reloading and verifying page count.
 */
export async function mergePDFs(
  items: { buffer: ArrayBuffer; name: string }[],
  outputFilename: string = 'merged-document-fileflix.pdf'
): Promise<PDFProcessingResult> {
  const startTime = performance.now();

  if (items.length < 2) {
    throw new PDFProcessingError('At least 2 PDF documents are required to merge.', 'TOO_FEW_FILES');
  }

  const mergedDoc = await PDFDocument.create();
  let expectedTotalPages = 0;

  for (const item of items) {
    try {
      const sourceDoc = await PDFDocument.load(item.buffer, { ignoreEncryption: false });
      const pageIndices = sourceDoc.getPageIndices();
      expectedTotalPages += pageIndices.length;

      const copiedPages = await mergedDoc.copyPages(sourceDoc, pageIndices);
      for (const page of copiedPages) {
        mergedDoc.addPage(page);
      }
    } catch (err: unknown) {
      throw new PDFProcessingError(
        `Failed while merging "${item.name}": ${err instanceof Error ? err.message : 'Invalid document.'}`,
        'MERGE_ITEM_ERROR'
      );
    }
  }

  const outputBytes = await mergedDoc.save();

  // Self-verification: independently load the generated PDF
  const verificationDoc = await PDFDocument.load(outputBytes);
  if (verificationDoc.getPageCount() !== expectedTotalPages) {
    throw new PDFProcessingError(
      `Merged PDF verification failed: expected ${expectedTotalPages} pages, but output contains ${verificationDoc.getPageCount()} pages.`,
      'VERIFICATION_FAILED'
    );
  }

  const blob = new Blob([outputBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const processingTimeMs = Math.round(performance.now() - startTime);

  return {
    blob,
    url,
    sizeBytes: outputBytes.byteLength,
    pageCount: expectedTotalPages,
    processingTimeMs,
    filename: outputFilename,
  };
}

/**
 * Transforms pages of a single PDF: reorders, filters (split/extract), and applies rotation.
 */
export async function transformPDFPages(
  sourceBuffer: ArrayBuffer,
  pages: PDFPageInfo[],
  outputFilename: string
): Promise<PDFProcessingResult> {
  const startTime = performance.now();

  const selectedPages = pages.filter((p) => p.selected);
  if (selectedPages.length === 0) {
    throw new PDFProcessingError('No pages selected. Please select at least one page to export.', 'NO_PAGES_SELECTED');
  }

  const sourceDoc = await PDFDocument.load(sourceBuffer, { ignoreEncryption: false });
  const outputDoc = await PDFDocument.create();

  // Extract selected pages in the given array order
  const indicesToCopy = selectedPages.map((p) => p.originalIndex);
  const copiedPages = await outputDoc.copyPages(sourceDoc, indicesToCopy);

  for (let i = 0; i < copiedPages.length; i++) {
    const page = copiedPages[i];
    const pageMeta = selectedPages[i];

    // Apply rotation
    page.setRotation(degrees(pageMeta.rotation % 360));
    outputDoc.addPage(page);
  }

  const outputBytes = await outputDoc.save();

  // Self-verification
  const verificationDoc = await PDFDocument.load(outputBytes);
  if (verificationDoc.getPageCount() !== selectedPages.length) {
    throw new PDFProcessingError(
      `Transformed PDF verification failed: expected ${selectedPages.length} pages, but output contains ${verificationDoc.getPageCount()} pages.`,
      'VERIFICATION_FAILED'
    );
  }

  const blob = new Blob([outputBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const processingTimeMs = Math.round(performance.now() - startTime);

  return {
    blob,
    url,
    sizeBytes: outputBytes.byteLength,
    pageCount: selectedPages.length,
    processingTimeMs,
    filename: outputFilename,
  };
}
