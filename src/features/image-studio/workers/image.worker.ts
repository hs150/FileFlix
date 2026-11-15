/**
 * FileFix Dedicated Image Processing Web Worker
 * Performs heavy canvas transforms and iterative compression off the main UI thread.
 */

self.onmessage = async (e: MessageEvent) => {
  const { id, sourceBlob, resize, crop, compression } = e.data;
  const startTime = performance.now();

  try {
    self.postMessage({ id, type: 'PROGRESS', message: 'Decoding image in Web Worker...' });

    // Use createImageBitmap inside worker (respects EXIF orientation)
    const bitmap = await createImageBitmap(sourceBlob, { imageOrientation: 'from-image' });
    const origWidth = bitmap.width;
    const origHeight = bitmap.height;

    if (origWidth === 0 || origHeight === 0) {
      throw new Error('Image bitmap has zero dimensions.');
    }

    // 1. Calculate Crop
    let cropX = 0;
    let cropY = 0;
    let cropW = origWidth;
    let cropH = origHeight;

    if (crop.enabled) {
      cropX = Math.min(Math.max(crop.x, 0), origWidth - 1);
      cropY = Math.min(Math.max(crop.y, 0), origHeight - 1);
      cropW = Math.min(Math.max(crop.width, 1), origWidth - cropX);
      cropH = Math.min(Math.max(crop.height, 1), origHeight - cropY);
    }

    // 2. Calculate Final Dimensions
    let finalWidth = cropW;
    let finalHeight = cropH;

    if (resize.enabled) {
      if (resize.width > 0 && resize.height > 0) {
        finalWidth = Math.round(resize.width);
        finalHeight = Math.round(resize.height);
      } else if (resize.width > 0) {
        finalWidth = Math.round(resize.width);
        finalHeight = Math.round(finalWidth / (cropW / cropH));
      } else if (resize.height > 0) {
        finalHeight = Math.round(resize.height);
        finalWidth = Math.round(finalHeight * (cropW / cropH));
      }
    }

    finalWidth = Math.max(1, finalWidth);
    finalHeight = Math.max(1, finalHeight);

    // 3. Render on OffscreenCanvas
    self.postMessage({ id, type: 'PROGRESS', message: 'Rendering transformations on OffscreenCanvas...' });
    const canvas = new OffscreenCanvas(finalWidth, finalHeight);
    const ctx = canvas.getContext('2d', { willReadFrequently: false });

    if (!ctx) {
      throw new Error('Failed to create 2D context on OffscreenCanvas.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (compression.format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, finalWidth, finalHeight);
    } else {
      ctx.clearRect(0, 0, finalWidth, finalHeight);
    }

    ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, finalWidth, finalHeight);
    bitmap.close(); // free bitmap memory immediately

    // 4. Encode & Optimize
    let finalBlob: Blob;
    let targetAchieved: boolean | undefined = undefined;
    let explanation: string | undefined = undefined;

    if (compression.targetSizeKb && compression.targetSizeKb > 0) {
      self.postMessage({
        id,
        type: 'PROGRESS',
        message: `Optimizing encoding for target size: ${compression.targetSizeKb} KB...`,
      });
      const targetBytes = compression.targetSizeKb * 1024;

      if (compression.format === 'image/png') {
        finalBlob = await canvas.convertToBlob({ type: 'image/png' });
        if (finalBlob.size > targetBytes) {
          targetAchieved = false;
          explanation = `PNG is lossless and could not reach ${compression.targetSizeKb} KB without dimension downscaling or format conversion.`;
        } else {
          targetAchieved = true;
        }
      } else {
        // Binary search across quality levels
        let low = 0.05;
        let high = 0.98;
        let bestBlob = await canvas.convertToBlob({ type: compression.format, quality: high });

        if (bestBlob.size <= targetBytes) {
          finalBlob = bestBlob;
          targetAchieved = true;
        } else {
          for (let step = 0; step < 7; step++) {
            const mid = (low + high) / 2;
            const candidateBlob = await canvas.convertToBlob({ type: compression.format, quality: mid });
            if (candidateBlob.size <= targetBytes) {
              bestBlob = candidateBlob;
              low = mid;
            } else {
              high = mid;
            }
          }

          if (bestBlob.size <= targetBytes) {
            finalBlob = bestBlob;
            targetAchieved = true;
          } else {
            const lowestQualityBlob = await canvas.convertToBlob({ type: compression.format, quality: low });
            if (lowestQualityBlob.size <= targetBytes) {
              finalBlob = lowestQualityBlob;
              targetAchieved = true;
            } else if (compression.allowDimensionReductionForTarget) {
              self.postMessage({ id, type: 'PROGRESS', message: 'Downscaling dimensions in worker...' });
              let scaleCanvas = canvas;
              let currentBlob = lowestQualityBlob;
              let scaleFactor = Math.sqrt(targetBytes / currentBlob.size) * 0.95;

              while (scaleFactor < 0.95 && scaleFactor > 0.1 && currentBlob.size > targetBytes) {
                const scaledW = Math.max(1, Math.round(scaleCanvas.width * scaleFactor));
                const scaledH = Math.max(1, Math.round(scaleCanvas.height * scaleFactor));

                const tempCanvas = new OffscreenCanvas(scaledW, scaledH);
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) break;

                if (compression.format === 'image/jpeg') {
                  tempCtx.fillStyle = '#ffffff';
                  tempCtx.fillRect(0, 0, scaledW, scaledH);
                }
                tempCtx.imageSmoothingEnabled = true;
                tempCtx.imageSmoothingQuality = 'high';
                tempCtx.drawImage(scaleCanvas, 0, 0, scaledW, scaledH);

                currentBlob = await tempCanvas.convertToBlob({ type: compression.format, quality: 0.7 });
                finalWidth = scaledW;
                finalHeight = scaledH;
                scaleCanvas = tempCanvas;
                scaleFactor *= 0.9;
              }

              finalBlob = currentBlob;
              targetAchieved = finalBlob.size <= targetBytes;
              explanation = targetAchieved
                ? `Achieved target size with automatic downscaling to ${finalWidth}x${finalHeight}px.`
                : `Reduced to ${finalWidth}x${finalHeight}px, resulting in ${(finalBlob.size / 1024).toFixed(1)} KB (target was ${compression.targetSizeKb} KB).`;
            } else {
              finalBlob = lowestQualityBlob;
              targetAchieved = false;
              explanation = `Target size ${compression.targetSizeKb} KB could not be reached at ${finalWidth}x${finalHeight}px without dimension downscaling (smallest achieved: ${(finalBlob.size / 1024).toFixed(1)} KB).`;
            }
          }
        }
      }
    } else {
      self.postMessage({
        id,
        type: 'PROGRESS',
        message: `Encoding to ${compression.format} at ${Math.round(compression.quality * 100)}% quality...`,
      });
      finalBlob = await canvas.convertToBlob({
        type: compression.format,
        quality: compression.quality,
      });
    }

    const processingTimeMs = Math.round(performance.now() - startTime);

    self.postMessage({
      id,
      type: 'SUCCESS',
      blob: finalBlob,
      width: finalWidth,
      height: finalHeight,
      sizeBytes: finalBlob.size,
      format: compression.format,
      processingTimeMs,
      targetSizeAchieved: targetAchieved,
      targetSizeExplanation: explanation,
    });
  } catch (err: unknown) {
    self.postMessage({
      id,
      type: 'ERROR',
      error: err instanceof Error ? err.message : 'Worker image processing failed.',
    });
  }
};
