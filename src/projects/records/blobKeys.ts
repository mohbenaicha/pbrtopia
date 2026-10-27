export const MODEL_BLOB_KEY = 'model.glb';
/** Marker kept in a project record when a thumbnail exists; the picture itself is in the `thumbnails` store. */
export const THUMBNAIL_MARKER = 'thumbnail.jpg';

/** The model file written after a Generate UV (generate R17); a fresh `id` per unwrap, so the file the record still points at is never overwritten. */
export const unwrappedModelBlobKey = (id: string): string => `model-${id}.glb`;
/** A reference image of the Generate panel (generate R22), under the id the panel gave it. Other characters become `_<hex>_` ("_" too), so two ids never share a key. */
export const referenceBlobKey = (id: string): string => `references/${id.replace(/[^A-Za-z0-9.-]/g, (character) => `_${character.codePointAt(0)!.toString(16)}_`)}`;
export const returnedImageBlobKey = (setId: string): string => `sets/${setId}/returned.png`;
export const setBlobPrefix = (setId: string): string => `sets/${setId}/`;

/** Letters, digits, ".", "_" and "-" only, and not "." or "..": a set id that can never reach into another set's file prefix. */
export const isPlainSetId = (setId: string): boolean => /^[A-Za-z0-9._-]+$/.test(setId) && setId !== '.' && setId !== '..';
