/** The working picture: always opaque RGBA8; `words` is a 32-bit view of the same buffer (0xAABBGGRR on little-endian machines). */
export interface Raster {
  width: number;
  height: number;
  bytes: Uint8ClampedArray;
  words: Uint32Array;
}

export function createRaster(width: number, height: number, colour = 0xffffffff): Raster {
  const buffer = new ArrayBuffer(width * height * 4);
  const words = new Uint32Array(buffer);
  words.fill(colour);
  return { width, height, bytes: new Uint8ClampedArray(buffer), words };
}

/** Wraps RGBA bytes (length 4*width*height) without copying. */
export function rasterFromBuffer(width: number, height: number, buffer: ArrayBuffer): Raster {
  return { width, height, bytes: new Uint8ClampedArray(buffer), words: new Uint32Array(buffer) };
}
