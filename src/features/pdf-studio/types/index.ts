export type PDFStudioMode = 'merge' | 'organize';

export interface PDFPageInfo {
  pageNumber: number; // 1-based
  originalIndex: number; // 0-based
  rotation: number; // 0, 90, 180, 270
  selected: boolean;
}

export interface PDFItem {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  pageCount: number;
  buffer: ArrayBuffer;
  isEncrypted: boolean;
  pages: PDFPageInfo[];
}

export interface PDFProcessingResult {
  blob: Blob;
  url: string;
  sizeBytes: number;
  pageCount: number;
  processingTimeMs: number;
  filename: string;
}
