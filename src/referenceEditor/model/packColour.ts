/** "#rrggbb" to an opaque 0xFFBBGGRR word (the byte order of a little-endian RGBA8 buffer). */
export function packColour(hex: string): number {
  const value = Number.parseInt(hex.slice(1, 7), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}
