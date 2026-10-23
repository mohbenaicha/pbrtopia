const TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let bit = 0; bit < 8; bit += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  TABLE[n] = c >>> 0;
}

/** The CRC-32 (the zip one) of everything given so far: start with 0 and pass each chunk's result to the next call. */
export function updateCrc32(crc: number, bytes: Uint8Array): number {
  let c = (crc ^ 0xffffffff) >>> 0;
  for (let at = 0; at < bytes.length; at += 1) c = TABLE[(c ^ bytes[at]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
