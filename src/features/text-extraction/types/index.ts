export interface ExtractedPage {
  pageNumber: number;
  text: string;
  characterCount: number;
  wordCount: number;
  isImageOnlyOrEmpty: boolean;
}

export interface ExtractionSummary {
  totalPages: number;
  textPagesCount: number;
  emptyOrImagePagesCount: number;
  totalCharacters: number;
  totalWords: number;
  requiresOCR: boolean;
  explanation: string;
}

export interface TextExtractionResult {
  filename: string;
  pages: ExtractedPage[];
  summary: ExtractionSummary;
  rawFullText: string;
  processingTimeMs: number;
}
