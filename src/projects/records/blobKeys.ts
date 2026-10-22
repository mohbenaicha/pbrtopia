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

/** The model file written after a Generate UV (generate R17); a fresh `id` per unwrap, so the file the record still points at is never overwritten. */
export const unwrappedModelBlobKey = (id: string): string => `model-${id}.glb`;
/** A reference image of the Generate panel (generate R22), under the id the panel gave it. Other characters become `_<hex>_` ("_" too), so two ids never share a key. */
export const referenceBlobKey = (id: string): string => `references/${id.replace(/[^A-Za-z0-9.-]/g, (character) => `_${character.codePointAt(0)!.toString(16)}_`)}`;
export const returnedImageBlobKey = (setId: string): string => `sets/${setId}/returned.png`;
/** A bake file has a fresh `bakeId` per save, so a new bake never overwrites the one the records still point at. */
export const bakeBlobKey = (setId: string, bakeId: string): string => `sets/${setId}/bake-${bakeId}.png`;
export const setBlobPrefix = (setId: string): string => `sets/${setId}/`;

/** Letters, digits, ".", "_" and "-" only, and not "." or "..": a set id that can never reach into another set's file prefix. */
export const isPlainSetId = (setId: string): boolean => /^[A-Za-z0-9._-]+$/.test(setId) && setId !== '.' && setId !== '..';
