// CPU reference images for the imageops GPU tests: small, deterministic and written from the spec, not from the shaders.

export interface RgbaImage {
  size: number;
  data: Uint8Array;
}

/** A busy test picture: every texel differs from its neighbours, so a shifted or flipped copy is detected. */
export function makePattern(size: number): RgbaImage {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const at = (y * size + x) * 4;
      data[at] = (x * 7 + y * 3) % 256;
      data[at + 1] = (y * 5 + x * x) % 256;
      data[at + 2] = (x * y + 11) % 256;
      data[at + 3] = 255;
    }
  }
  return { size, data };
}

/** A smooth diagonal gradient (no fine detail), for resampling checks. */
export function makeGradient(size: number): RgbaImage {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const at = (y * size + x) * 4;
      data[at] = Math.round((x / (size - 1)) * 200) + 20;
      data[at + 1] = Math.round((y / (size - 1)) * 200) + 20;
      data[at + 2] = 120;
      data[at + 3] = 255;
    }
  }
  return { size, data };
}

export function makeConstant(size: number, rgb: [number, number, number]): RgbaImage {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i += 1) data.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
  return { size, data };
}

/** Texels alternating 0 and 255 in both directions. */
export function makeChecker(size: number): RgbaImage {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) data.fill((x + y) % 2 === 0 ? 255 : 0, (y * size + x) * 4, (y * size + x) * 4 + 3);
  }
  for (let i = 0; i < size * size; i += 1) data[i * 4 + 3] = 255;
  return { size, data };
}

export const texel = (image: RgbaImage, x: number, y: number): number[] => Array.from(image.data.subarray((y * image.size + x) * 4, (y * image.size + x) * 4 + 3));

export function maxDifference(a: Uint8Array, b: Uint8Array, channels = 4): number {
  let worst = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (channels === 4 && i % 4 === 3) continue;
    worst = Math.max(worst, Math.abs(a[i]! - b[i]!));
  }
  return worst;
}

/** R36: out(x, y) = in((x + S/2) mod S, (y + S/2) mod S). */
export function referenceSwap(image: RgbaImage): RgbaImage {
  const { size } = image;
  const out = new Uint8Array(image.data.length);
  const half = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const from = (((y + half) % size) * size + ((x + half) % size)) * 4;
      out.set(image.data.subarray(from, from + 4), (y * size + x) * 4);
    }
  }
  return { size, data: out };
}

/** Each 2x2 block of the source averaged (the spec's "scaled to S/2" for an exact factor of two), in the stored values. */
export function referenceHalfScale(image: RgbaImage): RgbaImage {
  const half = image.size / 2;
  const out = new Uint8Array(half * half * 4);
  for (let y = 0; y < half; y += 1) {
    for (let x = 0; x < half; x += 1) {
      for (let c = 0; c < 3; c += 1) {
        const sum = [0, 1].flatMap((dy) => [0, 1].map((dx) => image.data[((y * 2 + dy) * image.size + x * 2 + dx) * 4 + c]!)).reduce((a, b) => a + b, 0);
        out[(y * half + x) * 4 + c] = Math.round(sum / 4);
      }
      out[(y * half + x) * 4 + 3] = 255;
    }
  }
  return { size: half, data: out };
}

/** The reference of R40: each quadrant of the result is the source scaled to half size. */
export function referenceTwoByTwoBake(image: RgbaImage): RgbaImage {
  const small = referenceHalfScale(image);
  const { size } = image;
  const half = size / 2;
  const out = new Uint8Array(image.data.length);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) out.set(small.data.subarray(((y % half) * half + (x % half)) * 4, ((y % half) * half + (x % half)) * 4 + 4), (y * size + x) * 4);
  }
  return { size, data: out };
}
