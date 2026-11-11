import { toRgba, type PixelImage } from '../gpu/pixelFormats';

/** Draws pixels onto a canvas and returns an object URL of the picture, for an `<img>`; the caller revokes it. */
export async function pixelsToPictureUrl(image: PixelImage): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('A canvas is not available.');
  context.putImageData(new ImageData(new Uint8ClampedArray(toRgba(image)), image.width, image.height), 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (blob === null) throw new Error('The picture could not be made.');
  return URL.createObjectURL(blob);
}
