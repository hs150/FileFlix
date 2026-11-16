import { ConversionAdapter, ConversionInput, ConversionOutput } from '../../core/conversion-types';
import { ConversionError } from '../../core/conversion-errors';
import { createEpubFromText } from './epub-generator';
import { extractTextFromEpub } from './epub-extractor';
import { convertCbzToPdf } from './cbz-engine';

export const ebookAdapter: ConversionAdapter = {
  id: 'ebook-adapter',
  category: 'ebook',
  supportedPairs: [
    { input: 'txt', output: 'epub' },
    { input: 'html', output: 'epub' },
    { input: 'epub', output: 'txt' },
    { input: 'cbz', output: 'pdf' },
  ],

  async execute(input: ConversionInput, options?: Record<string, any>): Promise<ConversionOutput> {
    const inputFormat = input.detectedFormat.formatId;
    const targetFormat = options?.targetFormat;
    const textDecoder = new TextDecoder('utf-8');
    const warnings: string[] = [];

    // 1. TXT / HTML -> EPUB
    if ((inputFormat === 'txt' || inputFormat === 'html') && targetFormat === 'epub') {
      const content = textDecoder.decode(input.buffer);
      const isHtml = inputFormat === 'html';
      const title = input.name.replace(/\.[^/.]+$/, '');

      const epubBytes = createEpubFromText(content, isHtml, {
        title,
        author: options?.author || 'FileFix Document',
        language: options?.language || 'en',
      });

      const blob = new Blob([epubBytes.buffer as ArrayBuffer], { type: 'application/epub+zip' });
      const filename = `${title}.epub`;

      warnings.push('Generated reflowable EPUB 3.3 package. Complex visual styles or fixed pagination may vary across e-readers.');

      return {
        blob,
        filename,
        mime: 'application/epub+zip',
        sizeBytes: blob.size,
        warnings,
        details: { title },
      };
    }

    // 2. EPUB -> TXT
    if (inputFormat === 'epub' && targetFormat === 'txt') {
      const { text, title, chapterCount } = extractTextFromEpub(input.buffer);
      const blob = new Blob([text], { type: 'text/plain' });
      const filename = `${input.name.replace(/\.epub$/i, '')}.txt`;

      warnings.push('Extracted linear text content. Embedded styling, layout formatting, and images were omitted.');

      return {
        blob,
        filename,
        mime: 'text/plain',
        sizeBytes: blob.size,
        warnings,
        details: { title, chapterCount },
      };
    }

    // 3. CBZ -> PDF
    if (inputFormat === 'cbz' && targetFormat === 'pdf') {
      const pdfBytes = await convertCbzToPdf(input.buffer);
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const filename = `${input.name.replace(/\.cbz$/i, '')}.pdf`;

      return {
        blob,
        filename,
        mime: 'application/pdf',
        sizeBytes: blob.size,
        warnings,
        details: {},
      };
    }

    throw new ConversionError(
      `Unsupported eBook conversion: ${inputFormat} -> ${targetFormat}`,
      'UNSUPPORTED_EBOOK_CONVERSION'
    );
  },
};
