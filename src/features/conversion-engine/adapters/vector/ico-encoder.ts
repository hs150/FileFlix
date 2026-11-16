/**
 * Authentic Windows Icon (.ico) Binary Encoder
 * Packages multiple resolution PNG images into standard Microsoft ICO binary structure.
 */

export interface IcoImageInput {
  width: number;
  height: number;
  pngBytes: Uint8Array;
}

export function encodeIco(images: IcoImageInput[]): Uint8Array {
  if (images.length === 0) {
    throw new Error('At least one icon image is required to generate an ICO file.');
  }

  const numImages = images.length;
  // 6-byte header + 16 bytes per image directory entry
  const headerAndDirSize = 6 + 16 * numImages;

  let totalDataSize = 0;
  for (const img of images) {
    totalDataSize += img.pngBytes.length;
  }

  const out = new Uint8Array(headerAndDirSize + totalDataSize);
  const view = new DataView(out.buffer);

  // 1. Write ICONDIR (6 bytes)
  view.setUint16(0, 0, true); // Reserved (0)
  view.setUint16(2, 1, true); // Resource Type (1 for icon)
  view.setUint16(4, numImages, true); // Number of images

  // 2. Write ICONDIRENTRY (16 bytes per image) and Data
  let dirOffset = 6;
  let dataOffset = headerAndDirSize;

  for (const img of images) {
    const w = img.width >= 256 ? 0 : img.width;
    const h = img.height >= 256 ? 0 : img.height;
    const size = img.pngBytes.length;

    out[dirOffset + 0] = w; // Width
    out[dirOffset + 1] = h; // Height
    out[dirOffset + 2] = 0; // Color count (0 = >=8bpp)
    out[dirOffset + 3] = 0; // Reserved
    view.setUint16(dirOffset + 4, 1, true); // Color planes
    view.setUint16(dirOffset + 6, 32, true); // Bits per pixel (32-bit RGBA)
    view.setUint32(dirOffset + 8, size, true); // Image data size in bytes
    view.setUint32(dirOffset + 12, dataOffset, true); // Offset of image data from beginning of file

    // Copy PNG bytes into output
    out.set(img.pngBytes, dataOffset);

    dirOffset += 16;
    dataOffset += size;
  }

  return out;
}
