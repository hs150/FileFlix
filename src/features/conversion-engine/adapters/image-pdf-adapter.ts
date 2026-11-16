import { ConversionAdapter, ConversionInput, ConversionOutput } from '../core/conversion-types';
import { ConversionError } from '../core/conversion-errors';
import { convertImageLocally } from '../../converter/lib/image-converter';
import { convertImagesToPdf } from '../../converter/lib/image-to-pdf';
import { convertPdfToImages } from '../../converter/lib/pdf-to-image';

export const imagePdfAdapter: ConversionAdapter = {
  id: 'image-pdf-adapter',
  category: 'image',
  supportedPairs: [
    { input: 'jpeg', output: 'png' },
    { input: 'jpeg', output: 'webp' },
    { input: 'jpeg', output: 'pdf' },
    { input: 'png', output: 'jpeg' },
    { input: 'png', output: 'webp' },
    { input: 'png', output: 'pdf' },
    { input: 'webp', output: 'jpeg' },
    { input: 'webp', output: 'png' },
    { input: 'webp', output: 'pdf' },
    { input: 'pdf', output: 'jpeg' },
    { input: 'pdf', output: 'png' },
  ],

  async execute(input: ConversionInput, options?: Record<string, any>): Promise<ConversionOutput> {
    const inputFormat = input.detectedFormat.formatId;
    const targetFormat = options?.targetFormat;

    // 1. Image -> Image
    if (['jpeg', 'png', 'webp'].includes(inputFormat) && ['jpeg', 'png', 'webp'].includes(targetFormat)) {
      const mime = targetFormat === 'jpeg' ? 'image/jpeg' : targetFormat === 'png' ? 'image/png' : 'image/webp';
      const res = await convertImageLocally(input.file, {
        targetFormat: mime,
        quality: options?.quality || 0.92,
      });

      const ext = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
      const filename = input.name.replace(/\.[^/.]+$/, `.${ext}`);

      return {
        blob: res.blob,
        filename,
        mime,
        sizeBytes: res.sizeBytes,
        warnings: res.warnings,
        details: { width: res.width, height: res.height },
      };
    }

    // 2. Image -> PDF
    if (['jpeg', 'png', 'webp'].includes(inputFormat) && targetFormat === 'pdf') {
      const filename = input.name.replace(/\.[^/.]+$/, '.pdf');
      const res = await convertImagesToPdf(
        [{ blob: input.file, name: input.name }],
        {
          pageSize: options?.pageSize || 'a4',
          orientation: options?.orientation || 'auto',
          margin: options?.margin || 'small',
        },
        filename
      );

      return {
        blob: res.blob,
        filename: res.filename,
        mime: 'application/pdf',
        sizeBytes: res.sizeBytes,
        warnings: res.warnings,
        details: { pageCount: res.pageCount },
      };
    }

    // 3. PDF -> Image
    if (inputFormat === 'pdf' && (targetFormat === 'jpeg' || targetFormat === 'png')) {
      const mime = targetFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
      const res = await convertPdfToImages(
        input.buffer,
        {
          targetFormat: mime,
          scale: options?.scale || 2,
          quality: options?.quality || 0.92,
        },
        input.name
      );

      if (res.pages.length === 1) {
        const page = res.pages[0];
        return {
          blob: page.blob,
          filename: page.filename,
          mime,
          sizeBytes: page.sizeBytes,
          warnings: res.warnings,
          details: { width: page.width, height: page.height, pageCount: 1 },
        };
      } else if (res.zipBlob) {
        const zipFilename = input.name.replace(/\.pdf$/i, '-pages.zip');
        return {
          blob: res.zipBlob,
          filename: zipFilename,
          mime: 'application/zip',
          sizeBytes: res.zipBlob.size,
          warnings: res.warnings,
          details: { pageCount: res.pages.length, pages: res.pages },
        };
      }
    }

    throw new ConversionError(
      `Unsupported image/pdf conversion: ${inputFormat} -> ${targetFormat}`,
      'UNSUPPORTED_CONVERSION'
    );
  },
};
