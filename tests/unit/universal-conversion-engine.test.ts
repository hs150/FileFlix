import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_FILE_FORMATS,
  UNIVERSAL_CONVERSION_REGISTRY,
  getFormatById,
  getAvailableOutputsForFormat,
  findConversionDefinition,
} from '@/features/conversion-engine/core/conversion-registry';
import { detectFileFormat } from '@/features/conversion-engine/core/format-detection';

describe('Universal Conversion Engine - Core Registry & Detection', () => {
  it('registers comprehensive file formats across all required categories', () => {
    expect(SUPPORTED_FILE_FORMATS.length).toBeGreaterThanOrEqual(18);

    const categories = new Set(SUPPORTED_FILE_FORMATS.map((f) => f.category));
    expect(categories.has('archive')).toBe(true);
    expect(categories.has('data')).toBe(true);
    expect(categories.has('vector')).toBe(true);
    expect(categories.has('ebook')).toBe(true);
    expect(categories.has('image')).toBe(true);
    expect(categories.has('pdf')).toBe(true);
  });

  it('guarantees every conversion definition has complete metadata and valid limits', () => {
    for (const def of UNIVERSAL_CONVERSION_REGISTRY) {
      expect(def.id).toBeTruthy();
      expect(def.inputFormat).toBeTruthy();
      expect(def.outputFormat).toBeTruthy();
      expect(def.engineId).toBeTruthy();
      expect(def.maxInputBytes).toBeGreaterThan(0);
      expect(def.lossinessExplanation).toBeTruthy();
      expect(['lossless', 'lossy', 'structural']).toContain(def.fidelity);
    }
  });

  it('correctly maps available outputs for CSV', () => {
    const outputs = getAvailableOutputsForFormat('csv');
    const ids = outputs.map((o) => o.id);
    expect(ids).toContain('json');
    expect(ids).toContain('tsv');
    expect(ids).toContain('xlsx');
    expect(ids).not.toContain('tar');
  });

  it('correctly maps available outputs for ZIP', () => {
    const outputs = getAvailableOutputsForFormat('zip');
    const ids = outputs.map((o) => o.id);
    expect(ids).toContain('tar');
  });

  it('correctly maps available outputs for SVG', () => {
    const outputs = getAvailableOutputsForFormat('svg');
    const ids = outputs.map((o) => o.id);
    expect(ids).toContain('png');
    expect(ids).toContain('jpeg');
    expect(ids).toContain('webp');
    expect(ids).toContain('ico');
    expect(ids).toContain('pdf');
  });

  it('detects binary magic bytes for JPEG, PNG, WebP, PDF, GZIP, and ICO', async () => {
    // JPEG
    const jpegBuf = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).buffer;
    const dJpeg = await detectFileFormat(jpegBuf, 'photo.jpg');
    expect(dJpeg?.formatId).toBe('jpeg');

    // PNG
    const pngBuf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
    const dPng = await detectFileFormat(pngBuf, 'image.png');
    expect(dPng?.formatId).toBe('png');

    // WebP
    const webpBuf = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]).buffer;
    const dWebp = await detectFileFormat(webpBuf, 'pic.webp');
    expect(dWebp?.formatId).toBe('webp');

    // PDF
    const pdfBuf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]).buffer;
    const dPdf = await detectFileFormat(pdfBuf, 'doc.pdf');
    expect(dPdf?.formatId).toBe('pdf');

    // GZIP
    const gzBuf = new Uint8Array([0x1f, 0x8b, 0x08, 0x00]).buffer;
    const dGz = await detectFileFormat(gzBuf, 'data.gz');
    expect(dGz?.formatId).toBe('gzip');

    // ICO
    const icoBuf = new Uint8Array([0x00, 0x00, 0x01, 0x00, 0x01, 0x00]).buffer;
    const dIco = await detectFileFormat(icoBuf, 'favicon.ico');
    expect(dIco?.formatId).toBe('ico');
  });

  it('detects text syntax for SVG, CSV, JSON, and XML', async () => {
    const encoder = new TextEncoder();

    // SVG
    const svgText = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle r="50"/></svg>';
    const dSvg = await detectFileFormat(encoder.encode(svgText).buffer, 'icon.svg');
    expect(dSvg?.formatId).toBe('svg');

    // JSON
    const jsonText = '{"name":"FileFix","verified":true}';
    const dJson = await detectFileFormat(encoder.encode(jsonText).buffer, 'data.json');
    expect(dJson?.formatId).toBe('json');

    // CSV
    const csvText = 'id,name,role\n1,Alice,Engineer\n2,Bob,Architect\n';
    const dCsv = await detectFileFormat(encoder.encode(csvText).buffer, 'table.csv');
    expect(dCsv?.formatId).toBe('csv');

    // XML
    const xmlText = '<?xml version="1.0"?><config><env>production</env></config>';
    const dXml = await detectFileFormat(encoder.encode(xmlText).buffer, 'file.xml');
    expect(dXml?.formatId).toBe('xml');
  });
});
