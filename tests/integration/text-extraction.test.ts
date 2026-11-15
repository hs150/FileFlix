import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { extractTextFromPDF } from '@/features/text-extraction/lib/text-extractor';

const PDF_FIXTURES_DIR = path.resolve(__dirname, '../fixtures/pdfs');

function loadFixtureBuffer(filename: string): ArrayBuffer {
  const buf = fs.readFileSync(path.join(PDF_FIXTURES_DIR, filename));
  const ab = new ArrayBuffer(buf.length);
  const view = new Uint8Array(ab);
  for (let i = 0; i < buf.length; i++) {
    view[i] = buf[i];
  }
  return ab;
}

describe('Text Extraction Studio Integration', () => {
  it('extracts text from single page PDF accurately', async () => {
    const buffer = loadFixtureBuffer('single-page.pdf');
    const result = await extractTextFromPDF(buffer, 'single-page.pdf');

    expect(result.summary.totalPages).toBe(1);
    expect(result.summary.textPagesCount).toBe(1);
    expect(result.summary.emptyOrImagePagesCount).toBe(0);
    expect(result.summary.requiresOCR).toBe(false);

    expect(result.pages.length).toBe(1);
    expect(result.pages[0].text).toContain('FileFix Synthetic Test Fixture');
    expect(result.pages[0].text).toContain('Single Page Document');
    expect(result.pages[0].characterCount).toBeGreaterThan(30);
    expect(result.pages[0].wordCount).toBeGreaterThan(5);

    expect(result.rawFullText).toContain('--- Page 1 ---');
  });

  it('extracts text from 3-page PDF with correct page boundaries', async () => {
    const buffer = loadFixtureBuffer('three-pages.pdf');
    const result = await extractTextFromPDF(buffer, 'three-pages.pdf');

    expect(result.summary.totalPages).toBe(3);
    expect(result.summary.textPagesCount).toBe(3);
    expect(result.summary.emptyOrImagePagesCount).toBe(0);

    expect(result.pages[0].text).toContain('Page 1');
    expect(result.pages[1].text).toContain('Page 2');
    expect(result.pages[2].text).toContain('Page 3');

    expect(result.rawFullText).toContain('--- Page 1 ---');
    expect(result.rawFullText).toContain('--- Page 2 ---');
    expect(result.rawFullText).toContain('--- Page 3 ---');
  });

  it('rejects corrupt or invalid PDF headers', async () => {
    const buffer = loadFixtureBuffer('corrupt.pdf');
    // corrupt.pdf has %PDF- header but invalid internal xref
    await expect(extractTextFromPDF(buffer, 'corrupt.pdf')).rejects.toThrow();
  });
});
