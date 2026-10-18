import type { TextureChannel } from './projectRecords';

export const MODEL_BLOB_KEY = 'model.glb';
/** Marker kept in a project record when a thumbnail exists; the picture itself is in the `thumbnails` store. */
export const THUMBNAIL_MARKER = 'thumbnail.jpg';

// Letters, digits, ".", "_", "-" and spaces stay; anything else could confuse a path, so it becomes "_".
const toFileName = (materialName: string): string => materialName.replace(/[^A-Za-z0-9._ -]/g, '_');

/** `textures/<material>-<channel>.png`, numbered `-2`, `-3` when another texture already took that name. */
export function textureBlobKey(materialName: string, channel: TextureChannel, takenKeys: readonly string[]): string {
  const stem = `textures/${toFileName(materialName)}-${channel}`;
  let key = `${stem}.png`;
  for (let number = 2; takenKeys.includes(key); number += 1) key = `${stem}-${number}.png`;
  return key;
}

export const returnedImageBlobKey = (setId: string): string => `sets/${setId}/returned.png`;
export const bakeBlobKey = (setId: string): string => `sets/${setId}/bake.png`;
export const setBlobPrefix = (setId: string): string => `sets/${setId}/`;
