// The PNG container: signature, chunks and their checksums (maps R58, R61).

export class PngError extends Error {}

export const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const typeBytes = (type: string): Uint8Array => Uint8Array.from(type, (character) => character.charCodeAt(0));

/** length, type, data, checksum over type and data. */
export function writeChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(typeBytes(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

export interface PngChunk {
  type: string;
  data: Uint8Array;
}

/** Every chunk up to IEND, each checked against its checksum. */
export function readChunks(bytes: Uint8Array): PngChunk[] {
  if (bytes.length < PNG_SIGNATURE.length || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) throw new PngError('This is not a PNG file.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: PngChunk[] = [];
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new PngError('The PNG file is cut short.');
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (view.getUint32(end - 4) !== crc32(bytes.subarray(offset + 4, end - 4))) throw new PngError(`The PNG file is damaged (${type} chunk).`);
    chunks.push({ type, data: bytes.subarray(offset + 8, end - 4) });
    if (type === 'IEND') return chunks;
    offset = end;
  }
  throw new PngError('The PNG file is cut short.');
}
