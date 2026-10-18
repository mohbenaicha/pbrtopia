export interface ThumbnailSpec {
  width: number;
  height: number;
  mime: 'image/jpeg' | 'image/png';
  quality: number;
}

export const DEFAULT_THUMBNAIL_SPEC: ThumbnailSpec = { width: 320, height: 240, mime: 'image/jpeg', quality: 0.8 };

// The largest centred part of the source that has the thumbnail's shape, so the picture is cropped and never stretched.
export function computeCoverCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): { sx: number; sy: number; sw: number; sh: number } {
  const targetShape = targetWidth / targetHeight;
  if (sourceWidth / sourceHeight > targetShape) {
    const sw = sourceHeight * targetShape;
    return { sx: (sourceWidth - sw) / 2, sy: 0, sw, sh: sourceHeight };
  }
  const sh = sourceWidth / targetShape;
  return { sx: 0, sy: (sourceHeight - sh) / 2, sw: sourceWidth, sh };
}

// Draws the current view and encodes it. `draw` must render synchronously, because the canvas does not keep its picture between frames.
export function captureThumbnail(draw: () => void, source: HTMLCanvasElement, spec: ThumbnailSpec = DEFAULT_THUMBNAIL_SPEC): Promise<Blob> {
  draw();
  const target = document.createElement('canvas');
  target.width = spec.width;
  target.height = spec.height;
  const context = target.getContext('2d');
  if (!context) return Promise.reject(new Error('Could not make a thumbnail canvas'));
  const { sx, sy, sw, sh } = computeCoverCrop(source.width, source.height, spec.width, spec.height);
  context.drawImage(source, sx, sy, sw, sh, 0, 0, spec.width, spec.height);
  return new Promise((resolve, reject) => {
    target.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the thumbnail'))), spec.mime, spec.quality);
  });
}
