export const MODEL_BLOB_KEY = 'model.glb';
/** Marker kept in a project record when a thumbnail exists; the picture itself is in the `thumbnails` store. */
export const THUMBNAIL_MARKER = 'thumbnail.jpg';

/** The model file written after a Generate UV (generate R17); a fresh `id` per unwrap, so the file the record still points at is never overwritten. */
export const unwrappedModelBlobKey = (id: string): string => `model-${id}.glb`;
/** The model file written by Apply in mesh edit mode (mesh edit R25); the store deletes one of these when it is replaced. */
export const EDITED_MODEL_PREFIX = 'model-edit-';
export const editedModelBlobKey = (id: string): string => `${EDITED_MODEL_PREFIX}${id}.glb`;
/** A reference image of the Generate panel (generate R22), under the id the panel gave it. Other characters become `_<hex>_` ("_" too), so two ids never share a key. */
export const referenceBlobKey = (id: string): string => `references/${id.replace(/[^A-Za-z0-9.-]/g, (character) => `_${character.codePointAt(0)!.toString(16)}_`)}`;
/** Image `index` of a set (custom R25). No extension: the record names the type. A set migrated from version 1 keeps its `returned.png` key in its record. */
export const setImageBlobKey = (setId: string, index: number): string => `sets/${setId}/images/${index}`;
export const setBlobPrefix = (setId: string): string => `sets/${setId}/`;
export const SETS_BLOB_PREFIX = 'sets/';

/** Letters, digits, ".", "_" and "-" only, and not "." or "..": a set id that can never reach into another set's file prefix. */
export const isPlainSetId = (setId: string): boolean => /^[A-Za-z0-9._-]+$/.test(setId) && setId !== '.' && setId !== '..';
