const END_RECORD_BYTES = 22;
const HEADER_BYTES = 46;
const END_SIGNATURE = 0x06054b50;
const HEADER_SIGNATURE = 0x02014b50;
const UTF8_NAME_FLAG = 0x800;

interface ChecksumRecord {
  name: string;
  crc: number; // CRC-32 of the entry's unpacked bytes, as the zip records it
}

function decodeName(bytes: Uint8Array, flags: number): string {
  if (flags & UTF8_NAME_FLAG) return new TextDecoder().decode(bytes);
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
}

/**
 * Reads the names and CRCs from the zip's central directory, given the last bytes of the zip (`tail`) and the zip's whole length.
 * Null when the tail does not hold a whole directory ending exactly at the end record, the count does not match the headers, or a name is listed twice.
 */
export function readCentralDirectoryChecksums(tail: Uint8Array, sourceBytes: number): ChecksumRecord[] | null {
  if (tail.length < END_RECORD_BYTES) return null;
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  const end = tail.length - END_RECORD_BYTES;
  if (view.getUint32(end, true) !== END_SIGNATURE) return null;
  const count = view.getUint16(end + 10, true);
  const size = view.getUint32(end + 12, true);
  const offset = view.getUint32(end + 16, true);
  if (offset + size !== sourceBytes - END_RECORD_BYTES || size > end) return null;
  const records: ChecksumRecord[] = [];
  const seen = new Set<string>();
  let at = end - size;
  while (at < end) {
    if (at + HEADER_BYTES > end || view.getUint32(at, true) !== HEADER_SIGNATURE) return null;
    const nameLength = view.getUint16(at + 28, true);
    const rest = nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    if (at + HEADER_BYTES + rest > end) return null;
    const name = decodeName(tail.subarray(at + HEADER_BYTES, at + HEADER_BYTES + nameLength), view.getUint16(at + 8, true));
    if (seen.has(name)) return null;
    seen.add(name);
    records.push({ name, crc: view.getUint32(at + 16, true) });
    at += HEADER_BYTES + rest;
  }
  return records.length === count ? records : null;
}
