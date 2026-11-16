import { describe, it, expect } from 'vitest';
import * as fflate from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { executeConversion } from '@/features/conversion-engine/core/conversion-executor';
import { ConversionInput } from '@/features/conversion-engine/core/conversion-types';
import { createEpubFromText } from '@/features/conversion-engine/adapters/ebook/epub-generator';
import { extractTextFromEpub } from '@/features/conversion-engine/adapters/ebook/epub-extractor';
import { convertCbzToPdf } from '@/features/conversion-engine/adapters/ebook/cbz-engine';

describe('eBook Conversions Integration', () => {
  const encoder = new TextEncoder();

  it('generates a compliant W3C EPUB 3.3 package with required container layout from plain text', async () => {
    const novelText = `Chapter 1: The Beginning\n\nIt was a dark and stormy night in the digital city.\n\nThe algorithm computed quietly.`;
    const epubBytes = createEpubFromText(novelText, false, {
      title: 'Digital Odyssey',
      author: 'Ada Lovelace',
      language: 'en',
    });

    expect(epubBytes.length).toBeGreaterThan(100);

    // Unzip EPUB to inspect W3C EPUB 3.3 internal package structure
    const unzipped = fflate.unzipSync(epubBytes);

    // 1. Check 'mimetype'
    expect(unzipped['mimetype']).toBeDefined();
    const mimeText = new TextDecoder().decode(unzipped['mimetype']).trim();
    expect(mimeText).toBe('application/epub+zip');

    // 2. Check META-INF/container.xml
    expect(unzipped['META-INF/container.xml']).toBeDefined();
    const containerStr = new TextDecoder().decode(unzipped['META-INF/container.xml']);
    expect(containerStr).toContain('full-path="OEBPS/content.opf"');

    // 3. Check OEBPS/content.opf
    expect(unzipped['OEBPS/content.opf']).toBeDefined();
    const opfStr = new TextDecoder().decode(unzipped['OEBPS/content.opf']);
    expect(opfStr).toContain('<dc:title>Digital Odyssey</dc:title>');
    expect(opfStr).toContain('<dc:creator>Ada Lovelace</dc:creator>');
    expect(opfStr).toContain('media-type="application/xhtml+xml"');

    // 4. Check OEBPS/nav.xhtml (EPUB 3 navigation doc)
    expect(unzipped['OEBPS/nav.xhtml']).toBeDefined();
    const navStr = new TextDecoder().decode(unzipped['OEBPS/nav.xhtml']);
    expect(navStr).toContain('<nav epub:type="toc"');

    // 5. Check OEBPS/chapter1.xhtml
    expect(unzipped['OEBPS/chapter1.xhtml']).toBeDefined();
    const chapStr = new TextDecoder().decode(unzipped['OEBPS/chapter1.xhtml']);
    expect(chapStr).toContain('<p>It was a dark and stormy night in the digital city.</p>');
  });

  it('extracts sequential linear text from an EPUB in spine reading order', async () => {
    const epubBytes = createEpubFromText('Paragraph one.\n\nParagraph two of the book.', false, {
      title: 'Linear Book',
      author: 'Author',
    });

    const { text, title } = extractTextFromEpub(epubBytes);
    expect(title).toBe('Linear Book');
    expect(text).toContain('Paragraph one.');
    expect(text).toContain('Paragraph two of the book.');
  });

  it('rejects DRM-encrypted EPUB packages with honest error message', () => {
    // Synthetic DRM-protected EPUB containing META-INF/encryption.xml
    const drmEpub = fflate.zipSync({
      mimetype: encoder.encode('application/epub+zip'),
      'META-INF/container.xml': encoder.encode('<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>'),
      'META-INF/encryption.xml': encoder.encode('<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"/>'),
    });

    expect(() => extractTextFromEpub(drmEpub)).toThrow(/digital rights management \(drm\)/i);
  });

  it('converts Comic Book ZIP (CBZ) containing images into structured multi-page PDF', async () => {
    // Synthetic minimal JPEG bytes
    const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x08, 0x00, 0x08, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xbf, 0x00, 0xff, 0xd9]);

    const cbzBytes = fflate.zipSync({
      'page_01.jpg': jpgBytes,
      'page_02.jpg': jpgBytes,
    });

    const pdfBytes = await convertCbzToPdf(cbzBytes);
    expect(pdfBytes.length).toBeGreaterThan(100);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    expect(pdfDoc.getPageCount()).toBe(2);
  });
});
