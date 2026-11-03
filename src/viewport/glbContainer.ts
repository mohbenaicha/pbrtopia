const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;

export interface GlbParts {
  json: Record<string, unknown>;
  bin: Uint8Array | null; // the first binary chunk, as a view of the file's bytes
}

const alignTo4 = (length: number): number => Math.ceil(length / 4) * 4;

/** The JSON and the binary chunk of a GLB; null when the bytes are not a whole, readable GLB (other chunks are ignored). */
export function readGlb(glb: ArrayBuffer): GlbParts | null {
  if (glb.byteLength < HEADER_BYTES + CHUNK_HEADER_BYTES) return null;
  const view = new DataView(glb);
  if (view.getUint32(0, true) !== GLB_MAGIC || view.getUint32(8, true) > glb.byteLength) return null;
  const end = view.getUint32(8, true);
  let json: Record<string, unknown> | null = null;
  let bin: Uint8Array | null = null;
  let offset = HEADER_BYTES;
  while (offset + CHUNK_HEADER_BYTES <= end) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + CHUNK_HEADER_BYTES;
    if (start + length > end) return null;
    if (type === JSON_CHUNK && json === null) {
      try {
        json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, start, length))) as Record<string, unknown>;
      } catch {
        return null;
      }
    } else if (type === BIN_CHUNK && bin === null) {
      bin = new Uint8Array(glb, start, length);
    }
    offset = start + alignTo4(length);
  }
  return json === null ? null : { json, bin };
}

/** A GLB holding this JSON and binary chunk, both padded to 4 bytes (the JSON with spaces, the binary with zeros). */
export function writeGlb(json: Record<string, unknown>, bin: Uint8Array | null): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = alignTo4(jsonBytes.length);
  const binLength = bin === null ? 0 : alignTo4(bin.length);
  const total = HEADER_BYTES + CHUNK_HEADER_BYTES + jsonLength + (bin === null ? 0 : CHUNK_HEADER_BYTES + binLength);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, JSON_CHUNK, true);
  out.fill(0x20, 20, 20 + jsonLength);
  out.set(jsonBytes, 20);
  if (bin !== null) {
    const at = 20 + jsonLength;
    view.setUint32(at, binLength, true);
    view.setUint32(at + 4, BIN_CHUNK, true);
    out.set(bin, at + CHUNK_HEADER_BYTES);
  }
  return out.buffer;
}
