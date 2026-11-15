import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, 'pdfs');

fs.mkdirSync(FIXTURES_DIR, { recursive: true });

async function main() {
  const manifest = [];

  // 1. Single Page PDF
  const doc1 = await PDFDocument.create();
  const font = await doc1.embedFont(StandardFonts.Helvetica);
  const page1 = doc1.addPage([400, 600]);
  page1.drawText('FileFix Synthetic Test Fixture - Single Page Document', {
    x: 30,
    y: 550,
    size: 14,
    font,
    color: rgb(0, 0, 0),
  });
  page1.drawText('This is sample page 1 text content for extraction and verification.', {
    x: 30,
    y: 520,
    size: 11,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
  const doc1Bytes = await doc1.save();
  const path1 = path.join(FIXTURES_DIR, 'single-page.pdf');
  fs.writeFileSync(path1, doc1Bytes);
  manifest.push({
    filename: 'single-page.pdf',
    pages: 1,
    bytes: doc1Bytes.byteLength,
    sha256: crypto.createHash('sha256').update(doc1Bytes).digest('hex'),
    description: 'Valid single-page PDF with extractable text',
  });

  // 2. Three Pages PDF
  const doc2 = await PDFDocument.create();
  const font2 = await doc2.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    const page = doc2.addPage([400, 600]);
    page.drawText(`Multi-Page Document - Page ${i}`, {
      x: 30,
      y: 550,
      size: 14,
      font: font2,
      color: rgb(0, 0, 0),
    });
    page.drawText(`Paragraph content on page ${i} for split and merge testing.`, {
      x: 30,
      y: 520,
      size: 11,
      font: font2,
      color: rgb(0.2, 0.2, 0.2),
    });
  }
  const doc2Bytes = await doc2.save();
  const path2 = path.join(FIXTURES_DIR, 'three-pages.pdf');
  fs.writeFileSync(path2, doc2Bytes);
  manifest.push({
    filename: 'three-pages.pdf',
    pages: 3,
    bytes: doc2Bytes.byteLength,
    sha256: crypto.createHash('sha256').update(doc2Bytes).digest('hex'),
    description: 'Valid 3-page PDF for split, reorder, and extraction tests',
  });

  // 3. Rotated Page PDF
  const doc3 = await PDFDocument.create();
  const page3 = doc3.addPage([400, 600]);
  page3.setRotation(degrees(90));
  const doc3Bytes = await doc3.save();
  const path3 = path.join(FIXTURES_DIR, 'rotated-page.pdf');
  fs.writeFileSync(path3, doc3Bytes);
  manifest.push({
    filename: 'rotated-page.pdf',
    pages: 1,
    bytes: doc3Bytes.byteLength,
    sha256: crypto.createHash('sha256').update(doc3Bytes).digest('hex'),
    description: 'Valid PDF with initial 90-degree page rotation',
  });

  // 4. Corrupt PDF
  const corruptBytes = Buffer.from('%PDF-1.4\ncorrupted_body_without_xref_or_trailer_blocks_here\n%%EOF');
  const path4 = path.join(FIXTURES_DIR, 'corrupt.pdf');
  fs.writeFileSync(path4, corruptBytes);
  manifest.push({
    filename: 'corrupt.pdf',
    pages: 0,
    bytes: corruptBytes.byteLength,
    sha256: crypto.createHash('sha256').update(corruptBytes).digest('hex'),
    description: 'Corrupt PDF with invalid internal structure',
  });

  fs.writeFileSync(path.join(FIXTURES_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Generated ${manifest.length} PDF synthetic fixtures.`);
}

main().catch(console.error);
