import { ConversionAdapter, ConversionInput, ConversionOutput } from '../../core/conversion-types';
import { ConversionError } from '../../core/conversion-errors';
import { sanitizeSvg } from './svg-sanitizer';
import { encodeIco, IcoImageInput } from './ico-encoder';
import { PDFDocument } from 'pdf-lib';

export const vectorAdapter: ConversionAdapter = {
  id: 'vector-adapter',
  category: 'vector',
  supportedPairs: [
    { input: 'svg', output: 'png' },
    { input: 'svg', output: 'jpeg' },
    { input: 'svg', output: 'webp' },
    { input: 'svg', output: 'ico' },
    { input: 'png', output: 'ico' },
    { input: 'jpeg', output: 'ico' },
    { input: 'svg', output: 'pdf' },
  ],

  async execute(input: ConversionInput, options?: Record<string, any>): Promise<ConversionOutput> {
    const inputFormat = input.detectedFormat.formatId;
    const targetFormat = options?.targetFormat;
    const warnings: string[] = [];

    // Helper: render SVG to canvas
    const renderSvgToCanvas = async (
      svgStr: string,
      targetWidth?: number,
      targetHeight?: number
    ): Promise<HTMLCanvasElement | OffscreenCanvas> => {
      const sanitizedObj = sanitizeSvg(svgStr);
      if (sanitizedObj.wasSanitized) {
        warnings.push(...sanitizedObj.issues);
      }

      // Extract width/height or viewBox from SVG if not provided
      let w = targetWidth || 512;
      let h = targetHeight || 512;

      const vbMatch = sanitizedObj.sanitized.match(/viewBox\s*=\s*["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/i);
      if (vbMatch && !targetWidth) {
        const vbW = parseFloat(vbMatch[3]);
        const vbH = parseFloat(vbMatch[4]);
        if (vbW > 0 && vbH > 0) {
          w = Math.round(vbW);
          h = Math.round(vbH);
        }
      }

      const svgBlob = new Blob([sanitizedObj.sanitized], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);

      try {
        if (typeof document !== 'undefined') {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load sanitized SVG into browser image element.'));
            img.src = svgUrl;
          });

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not acquire 2D canvas context.');

          ctx.drawImage(img, 0, 0, w, h);
          return canvas;
        } else if (typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined') {
          const bitmap = await createImageBitmap(svgBlob);
          const canvas = new OffscreenCanvas(w, h);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not acquire 2D context on OffscreenCanvas.');
          ctx.drawImage(bitmap, 0, 0, w, h);
          bitmap.close();
          return canvas;
        }

        throw new Error('Canvas rendering context not available.');
      } finally {
        URL.revokeObjectURL(svgUrl);
      }
    };

    // Helper: Canvas to Blob
    const canvasToBlobHelper = async (
      canvas: HTMLCanvasElement | OffscreenCanvas,
      mime: string,
      quality?: number
    ): Promise<Blob> => {
      if ('convertToBlob' in canvas) {
        return (canvas as OffscreenCanvas).convertToBlob({ type: mime, quality });
      }
      return new Promise<Blob>((resolve, reject) => {
        (canvas as HTMLCanvasElement).toBlob(
          (b) => (b ? resolve(b) : reject(new Error(`Failed to encode canvas to ${mime}`))),
          mime,
          quality
        );
      });
    };

    // 1. SVG -> Raster (PNG, JPEG, WebP)
    if (inputFormat === 'svg' && ['png', 'jpeg', 'webp'].includes(targetFormat)) {
      const svgText = new TextDecoder('utf-8').decode(input.buffer);
      const canvas = await renderSvgToCanvas(svgText);
      const mime = targetFormat === 'jpeg' ? 'image/jpeg' : targetFormat === 'png' ? 'image/png' : 'image/webp';

      if (targetFormat === 'jpeg') {
        // Flatten transparency against white background
        const fillCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(canvas.width, canvas.height);
        fillCanvas.width = canvas.width;
        fillCanvas.height = canvas.height;
        const ctx = fillCanvas.getContext('2d') as CanvasRenderingContext2D | null;
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(canvas, 0, 0);
          warnings.push('Transparency flattened to solid white background for JPEG compatibility.');
          const blob = await canvasToBlobHelper(fillCanvas, mime, 0.92);
          const filename = input.name.replace(/\.svg$/i, '.jpg');
          return { blob, filename, mime, sizeBytes: blob.size, warnings, details: { width: canvas.width, height: canvas.height } };
        }
      }

      const blob = await canvasToBlobHelper(canvas, mime, 0.92);
      const ext = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
      const filename = input.name.replace(/\.svg$/i, `.${ext}`);

      return {
        blob,
        filename,
        mime,
        sizeBytes: blob.size,
        warnings,
        details: { width: canvas.width, height: canvas.height },
      };
    }

    // 2. SVG -> ICO
    if (inputFormat === 'svg' && targetFormat === 'ico') {
      const svgText = new TextDecoder('utf-8').decode(input.buffer);
      const standardSizes = [16, 32, 48, 64, 128, 256];
      const iconEntries: IcoImageInput[] = [];

      for (const size of standardSizes) {
        const canvas = await renderSvgToCanvas(svgText, size, size);
        const pngBlob = await canvasToBlobHelper(canvas, 'image/png');
        const pngBuf = await pngBlob.arrayBuffer();
        iconEntries.push({
          width: size,
          height: size,
          pngBytes: new Uint8Array(pngBuf),
        });
      }

      const icoBytes = encodeIco(iconEntries);
      const blob = new Blob([icoBytes.buffer as ArrayBuffer], { type: 'image/x-icon' });
      const filename = input.name.replace(/\.svg$/i, '.ico');

      return {
        blob,
        filename,
        mime: 'image/x-icon',
        sizeBytes: blob.size,
        warnings,
        details: { iconResolutions: standardSizes },
      };
    }

    // 3. PNG/JPEG -> ICO
    if ((inputFormat === 'png' || inputFormat === 'jpeg') && targetFormat === 'ico') {
      const standardSizes = [16, 32, 48, 64, 128, 256];
      const iconEntries: IcoImageInput[] = [];
      const imgBlob = new Blob([input.buffer]);
      const imgUrl = URL.createObjectURL(imgBlob);

      try {
        if (typeof document !== 'undefined') {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image for ICO generation.'));
            img.src = imgUrl;
          });

          for (const size of standardSizes) {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, size, size);
              const pngBlob = await canvasToBlobHelper(canvas, 'image/png');
              const pngBuf = await pngBlob.arrayBuffer();
              iconEntries.push({
                width: size,
                height: size,
                pngBytes: new Uint8Array(pngBuf),
              });
            }
          }
        }
      } finally {
        URL.revokeObjectURL(imgUrl);
      }

      const icoBytes = encodeIco(iconEntries);
      const blob = new Blob([icoBytes.buffer as ArrayBuffer], { type: 'image/x-icon' });
      const filename = input.name.replace(/\.[^/.]+$/, '.ico');

      return {
        blob,
        filename,
        mime: 'image/x-icon',
        sizeBytes: blob.size,
        warnings,
        details: { iconResolutions: standardSizes },
      };
    }

    // 4. SVG -> PDF
    if (inputFormat === 'svg' && targetFormat === 'pdf') {
      const svgText = new TextDecoder('utf-8').decode(input.buffer);
      const canvas = await renderSvgToCanvas(svgText);
      const pngBlob = await canvasToBlobHelper(canvas, 'image/png');
      const pngBuf = await pngBlob.arrayBuffer();

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([canvas.width, canvas.height]);
      const embeddedImg = await pdfDoc.embedPng(pngBuf);
      page.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height,
      });

      warnings.push('SVG vector graphics were rasterized at native resolution for PDF embedding.');
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const filename = input.name.replace(/\.svg$/i, '.pdf');

      return {
        blob,
        filename,
        mime: 'application/pdf',
        sizeBytes: blob.size,
        warnings,
        details: { width: canvas.width, height: canvas.height },
      };
    }

    throw new ConversionError(
      `Unsupported vector conversion: ${inputFormat} -> ${targetFormat}`,
      'UNSUPPORTED_VECTOR_CONVERSION'
    );
  },
};
