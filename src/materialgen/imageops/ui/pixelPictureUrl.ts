import { toRgba, type PixelImage } from '../gpu/pixelFormats';

/** Draws pixels onto a canvas and returns a PNG data URL of the picture, for an `<img>` (revoking it is harmless). */
export async function pixelsToPictureUrl(image: PixelImage): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('A canvas is not available.');
  context.putImageData(new ImageData(new Uint8ClampedArray(toRgba(image)), image.width, image.height), 0, 0);
  return canvas.toDataURL('image/png'); // R87: toBlob waits for an idle period of the page, which a click without movement never gives
}
