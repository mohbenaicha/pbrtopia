import type { ReferenceImage } from '../generateStore';

// R2: a picked file as a reference image. Throws when the browser cannot decode it as an image.
export async function readImageFile(file: File): Promise<ReferenceImage> {
  const bitmap = await createImageBitmap(file);
  const image: ReferenceImage = { id: `${file.name}:${file.size}:${file.lastModified}`, name: file.name, width: bitmap.width, height: bitmap.height, blob: file };
  bitmap.close();
  return image;
}
