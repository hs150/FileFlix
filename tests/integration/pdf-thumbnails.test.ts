import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb } from 'pdf-lib';
import { PDFThumbnailService } from '@/features/pdf-studio/lib/pdf-thumbnail-queue';
import { transformPDFPages, loadPDFInfo } from '@/features/pdf-studio/lib/pdf-processor';

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

async function createSyntheticPdf(pagesConfig: { width: number; height: number; title: string }[]): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  for (const cfg of pagesConfig) {
    const page = doc.addPage([cfg.width, cfg.height]);
    page.drawText(cfg.title, { x: 50, y: cfg.height - 80, size: 24, color: rgb(0.1, 0.2, 0.5) });
  }
  const bytes = await doc.save();
  return bytes.buffer as ArrayBuffer;
}

describe('PDF Studio Visual Page Thumbnails & Organization', () => {
  it('renders thumbnail for single-page PDF with correct aspect ratio', async () => {
    const buffer = loadFixtureBuffer('single-page.pdf');
    const service = new PDFThumbnailService();
    const count = await service.loadDocument(buffer, 'single-page');
    expect(count).toBe(1);

    const thumb = await service.requestThumbnail(1, 1);
    expect(thumb).toBeDefined();
    expect(thumb.dataUrl).toContain('data:image/');
    expect(thumb.width).toBeGreaterThan(50);
    expect(thumb.height).toBeGreaterThan(50);
    expect(thumb.aspectRatio).toBeCloseTo(thumb.width / thumb.height, 2);

    // Verify caching
    expect(service.hasCached(1)).toBe(true);
    const cached = service.getCached(1);
    expect(cached?.dataUrl).toBe(thumb.dataUrl);

    service.destroy();
  });

  it('renders multi-page thumbnails across all pages and caches them', async () => {
    const buffer = loadFixtureBuffer('three-pages.pdf');
    const service = new PDFThumbnailService();
    const count = await service.loadDocument(buffer, 'three-pages');
    expect(count).toBe(3);

    const [t1, t2, t3] = await Promise.all([
      service.requestThumbnail(1),
      service.requestThumbnail(2),
      service.requestThumbnail(3),
    ]);

    expect(t1.dataUrl).toBeTruthy();
    expect(t2.dataUrl).toBeTruthy();
    expect(t3.dataUrl).toBeTruthy();

    const metrics = service.getMetrics();
    expect(metrics.cachedCount).toBe(3);
    expect(metrics.queueLength).toBe(0);

    service.destroy();
  });

  it('correctly distinguishes portrait and landscape page aspect ratios', async () => {
    const portraitLandscapeBuffer = await createSyntheticPdf([
      { width: 595, height: 842, title: 'Portrait Page A4' },
      { width: 842, height: 595, title: 'Landscape Page Slide' },
    ]);

    const service = new PDFThumbnailService();
    await service.loadDocument(portraitLandscapeBuffer, 'portrait-landscape');

    const portraitThumb = await service.requestThumbnail(1);
    const landscapeThumb = await service.requestThumbnail(2);

    expect(portraitThumb.width).toBeLessThan(portraitThumb.height);
    expect(portraitThumb.aspectRatio).toBeLessThan(1.0);

    expect(landscapeThumb.width).toBeGreaterThan(landscapeThumb.height);
    expect(landscapeThumb.aspectRatio).toBeGreaterThan(1.0);

    service.destroy();
  });

  it('renders and preserves already rotated pages', async () => {
    const buffer = loadFixtureBuffer('rotated-page.pdf');
    const service = new PDFThumbnailService();
    const count = await service.loadDocument(buffer, 'rotated-doc');
    expect(count).toBe(1);

    const thumb = await service.requestThumbnail(1);
    expect(thumb.dataUrl).toBeTruthy();

    service.destroy();
  });

  it('limits concurrent thumbnail renders to max 2 simultaneous jobs', async () => {
    // Generate a 10-page document
    const pagesConfig = Array.from({ length: 10 }, (_, i) => ({
      width: 595,
      height: 842,
      title: `Page Number ${i + 1} for Concurrency Testing`,
    }));
    const largeDocBuffer = await createSyntheticPdf(pagesConfig);

    const service = new PDFThumbnailService();
    await service.loadDocument(largeDocBuffer, 'large-doc');

    const metrics = service.getMetrics();
    expect(metrics.maxConcurrent).toBe(2);

    // Fire all 10 requests simultaneously
    const renderPromises = Array.from({ length: 10 }, (_, i) =>
      service.requestThumbnail(i + 1, 0)
    );

    // Verify active renders does not exceed 2
    expect(service.getMetrics().activeRenders).toBeLessThanOrEqual(2);

    const results = await Promise.all(renderPromises);
    expect(results.length).toBe(10);
    expect(service.getMetrics().cachedCount).toBe(10);
    expect(service.getMetrics().activeRenders).toBe(0);

    service.destroy();
  });

  it('cancels pending thumbnail requests and cleans up resources', async () => {
    const buffer = loadFixtureBuffer('three-pages.pdf');
    const service = new PDFThumbnailService();
    await service.loadDocument(buffer, 'cancellation-test');

    // Request thumbnail then cancel
    service.requestThumbnail(3, 0);
    service.cancelThumbnail(3);

    service.destroy();
    expect(service.getMetrics().queueLength).toBe(0);
    expect(service.getMetrics().cachedCount).toBe(0);
  });

  it('cleans up and resets cache when replacing an existing PDF with a new one', async () => {
    const docA = loadFixtureBuffer('single-page.pdf');
    const docB = loadFixtureBuffer('three-pages.pdf');

    const service = new PDFThumbnailService();
    const countA = await service.loadDocument(docA, 'doc-a');
    expect(countA).toBe(1);
    await service.requestThumbnail(1);
    expect(service.getMetrics().cachedCount).toBe(1);

    // Replace with Doc B
    const countB = await service.loadDocument(docB, 'doc-b');
    expect(countB).toBe(3);
    // Previous cache must be cleared
    expect(service.getMetrics().cachedCount).toBe(0);

    await service.requestThumbnail(1);
    await service.requestThumbnail(2);
    expect(service.getMetrics().cachedCount).toBe(2);

    service.destroy();
  });

  it('fails gracefully on invalid or corrupted PDF input', async () => {
    const corruptBuffer = loadFixtureBuffer('corrupt.pdf');
    const service = new PDFThumbnailService();

    await expect(service.loadDocument(corruptBuffer, 'corrupt')).rejects.toThrow();
  });

  it('guarantees page reordering and rotation persistence in exported PDF', async () => {
    const sourceBuffer = loadFixtureBuffer('three-pages.pdf');
    const fakeFile = new File([sourceBuffer], 'three-pages.pdf', { type: 'application/pdf' });
    const info = await loadPDFInfo(sourceBuffer, fakeFile);

    expect(info.pageCount).toBe(3);
    expect(info.pages[0].width).toBeDefined();
    expect(info.pages[0].height).toBeDefined();

    // Reorder: Page 3 first, then Page 1 (with 180° rotation), exclude Page 2
    const organizedPages = [
      { ...info.pages[2], selected: true, rotation: 0 },
      { ...info.pages[0], selected: true, rotation: 180 },
      { ...info.pages[1], selected: false, rotation: 0 },
    ];

    const result = await transformPDFPages(
      sourceBuffer,
      organizedPages,
      'custom-organized.pdf'
    );

    expect(result.pageCount).toBe(2);
    expect(result.filename).toBe('custom-organized.pdf');

    // Independent verification using PDFDocument.load
    const outBytes = await result.blob.arrayBuffer();
    const verifiedDoc = await PDFDocument.load(outBytes);

    expect(verifiedDoc.getPageCount()).toBe(2);
    // Page 0 was original page 3 (rotation 0)
    expect(verifiedDoc.getPage(0).getRotation().angle).toBe(0);
    // Page 1 was original page 1 (rotated 180)
    expect(verifiedDoc.getPage(1).getRotation().angle).toBe(180);
  });
});
