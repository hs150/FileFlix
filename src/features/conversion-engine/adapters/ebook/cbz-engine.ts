import * as fflate from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { ConversionError } from '../../core/conversion-errors';

/**
 * Comic Book ZIP (CBZ) to PDF Converter
 * Unpacks comic book images in sequential order and packages them into high-fidelity PDF pages.
 */
export async function convertCbzToPdf(cbzBuffer: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const u8 = cbzBuffer instanceof Uint8Array ? cbzBuffer : new Uint8Array(cbzBuffer);
  const unzipped = fflate.unzipSync(u8);

  // Filter image entries
  const imageExtensions = /\.(jpe?g|png)$/i;
  const imageNames = Object.keys(unzipped).filter(
    (name) => imageExtensions.test(name) && !name.startsWith('__MACOSX') && !name.includes('/.')
  );

  if (imageNames.length === 0) {
    throw new ConversionError('The CBZ archive contains no supported image files (JPEG, PNG).', 'NO_IMAGES_IN_CBZ');
  }

  // Sort images naturally
  imageNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setCreator('FileFix Comic Book Engine');

  for (const name of imageNames) {
    const imgBytes = unzipped[name];
    let embeddedImg;

    if (/\.jpe?g$/i.test(name)) {
      embeddedImg = await pdfDoc.embedJpg(imgBytes);
    } else {
      embeddedImg = await pdfDoc.embedPng(imgBytes);
    }

    const { width, height } = embeddedImg;
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  return await pdfDoc.save();
}
