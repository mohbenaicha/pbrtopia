import { StoreAbort, storeFailure } from '../projects';

export const TILE_HALF_FLOATS = 64 * 64;
export const TILE_BYTES = TILE_HALF_FLOATS * 2;

const corrupt = (message: string): StoreAbort => new StoreAbort(storeFailure('corrupt', message).error);

function refuseUnsaveableValue(_key: string, value: unknown): unknown {
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value) || value instanceof Blob) throw corrupt('A saved record held raw bytes that the library cannot store as text.');
  if (typeof value === 'number' && !Number.isFinite(value)) throw corrupt('A saved record held a number that cannot be stored.');
  return value;
}

/** Storage-backends R5: a record as JSON text bytes. Bytes, Blobs and non-finite numbers are refused as "corrupt" rather than saved wrongly. */
export function encodeJsonRecord(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value, refuseUnsaveableValue));
}

/** Storage-backends R9: the record the bytes hold, or the fallback when they are not valid text or JSON, so a damaged record is listed as unreadable. */
export function decodeJsonOr(bytes: Uint8Array, fallback: () => unknown): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return fallback();
  }
}

/** Storage-backends R5: 4096 half floats as 8192 little-endian bytes. */
export function encodeTile(halfFloats: Uint16Array): Uint8Array {
  if (halfFloats.length !== TILE_HALF_FLOATS) throw corrupt('A brush tile had the wrong size.');
  const bytes = new Uint8Array(TILE_BYTES);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < TILE_HALF_FLOATS; i++) view.setUint16(i * 2, halfFloats[i]!, true);
  return bytes;
}

export function decodeTile(bytes: Uint8Array): Uint16Array {
  if (bytes.length !== TILE_BYTES) throw corrupt('A stored brush tile had the wrong size.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const halfFloats = new Uint16Array(TILE_HALF_FLOATS);
  for (let i = 0; i < TILE_HALF_FLOATS; i++) halfFloats[i] = view.getUint16(i * 2, true);
  return halfFloats;
}

/** The record key of a tile: `setId/layer/tx/ty`. */
export function tileKey([setId, layer, tx, ty]: [string, number, number, number]): string {
  return `${setId}/${layer}/${tx}/${ty}`;
}

/** Reads the three numbers from the right, so a set id that holds "/" still comes back whole. */
export function parseTileKey(key: string): [string, number, number, number] {
  const parts = key.split('/');
  const [layer, tx, ty] = parts.slice(-3).map(Number) as [number, number, number];
  return [parts.slice(0, -3).join('/'), layer, tx, ty];
}

export async function thumbnailToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

export function bytesToThumbnail(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: 'image/jpeg' });
}
