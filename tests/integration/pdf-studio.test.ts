import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadPDFInfo, mergePDFs, transformPDFPages, PDFProcessingError } from '@/features/pdf-studio/lib/pdf-processor';
import { PDFDocument } from 'pdf-lib';

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

describe('PDF Studio Core Processing', () => {
  it('loads single page PDF metadata accurately', async () => {
    const buffer = loadFixtureBuffer('single-page.pdf');
    const fakeFile = new File([buffer], 'single-page.pdf', { type: 'application/pdf' });
    const info = await loadPDFInfo(buffer, fakeFile);

    expect(info.pageCount).toBe(1);
    expect(info.pages.length).toBe(1);
    expect(info.pages[0].rotation).toBe(0);
  });

  it('loads multi-page PDF metadata accurately', async () => {
    const buffer = loadFixtureBuffer('three-pages.pdf');
    const fakeFile = new File([buffer], 'three-pages.pdf', { type: 'application/pdf' });
    const info = await loadPDFInfo(buffer, fakeFile);

    expect(info.pageCount).toBe(3);
    expect(info.pages.length).toBe(3);
  });

  it('detects existing page rotation', async () => {
    const buffer = loadFixtureBuffer('rotated-page.pdf');
    const fakeFile = new File([buffer], 'rotated-page.pdf', { type: 'application/pdf' });
    const info = await loadPDFInfo(buffer, fakeFile);

    expect(info.pageCount).toBe(1);
    expect(info.pages[0].rotation).toBe(90);
  });

  it('fails safely on corrupt PDF file', async () => {
    const buffer = loadFixtureBuffer('corrupt.pdf');
    const fakeFile = new File([buffer], 'corrupt.pdf', { type: 'application/pdf' });

    await expect(loadPDFInfo(buffer, fakeFile)).rejects.toThrowError();
  });

  it('merges two documents and verifies output page count', async () => {
    const buf1 = loadFixtureBuffer('single-page.pdf');
    const buf2 = loadFixtureBuffer('three-pages.pdf');

    const result = await mergePDFs([
      { buffer: buf1, name: 'doc1.pdf' },
      { buffer: buf2, name: 'doc2.pdf' },
    ]);

    expect(result.pageCount).toBe(4);
    expect(result.sizeBytes).toBeGreaterThan(0);

    // Independently verify using PDFDocument.load
    const arrayBuf = await result.blob.arrayBuffer();
    const verified = await PDFDocument.load(arrayBuf);
    expect(verified.getPageCount()).toBe(4);
  });

  it('extracts and rotates selected pages', async () => {
    const buf = loadFixtureBuffer('three-pages.pdf');
    const fakeFile = new File([buf], 'three-pages.pdf', { type: 'application/pdf' });
    const info = await loadPDFInfo(buf, fakeFile);

    // Keep only page 2 and page 3, rotate page 2 by 90 degrees
    const pageActions = [
      { ...info.pages[1], selected: true, rotation: 90 },
      { ...info.pages[2], selected: true, rotation: 0 },
    ];

    const result = await transformPDFPages(buf, pageActions, 'extracted.pdf');
    expect(result.pageCount).toBe(2);

    const arrayBuf = await result.blob.arrayBuffer();
    const verified = await PDFDocument.load(arrayBuf);
    expect(verified.getPageCount()).toBe(2);
    expect(verified.getPage(0).getRotation().angle).toBe(90);
    expect(verified.getPage(1).getRotation().angle).toBe(0);
  });

  it('rejects merging fewer than 2 files', async () => {
    const buf = loadFixtureBuffer('single-page.pdf');
    await expect(mergePDFs([{ buffer: buf, name: 'doc.pdf' }])).rejects.toThrow(
      PDFProcessingError
    );
  });

  it('rejects transforming when no pages are selected', async () => {
    const buf = loadFixtureBuffer('single-page.pdf');
    await expect(transformPDFPages(buf, [], 'empty.pdf')).rejects.toThrow(
      PDFProcessingError
    );
  });
});
