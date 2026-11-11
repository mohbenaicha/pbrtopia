function halfToNumber(half: number): number {
  const sign = half & 0x8000 ? -1 : 1;
  const exponent = (half >> 10) & 0x1f;
  const fraction = half & 0x3ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) return fraction === 0 ? sign * Infinity : Number.NaN;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

/**
 * Masks R75: `count` vectors of `dim` half-precision numbers (little-endian, one after the other) as float32 vectors. A file whose length is not
 * exactly count x dim x 2 bytes is refused.
 */
export function decodeFloat16Vectors(bytes: Uint8Array, count: number, dim: number): Float32Array[] {
  if (bytes.byteLength !== count * dim * 2) throw new Error(`The vectors file holds ${bytes.byteLength} bytes, not ${count * dim * 2}.`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from({ length: count }, (_, vector) => {
    const numbers = new Float32Array(dim);
    for (let at = 0; at < dim; at += 1) numbers[at] = halfToNumber(view.getUint16((vector * dim + at) * 2, true));
    return numbers;
  });
}
