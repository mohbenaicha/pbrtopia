export type Rgb = readonly [number, number, number];
export type Lab = readonly [number, number, number];

// D65 white point
const WHITE_X = 0.95047;
const WHITE_Z = 1.08883;
const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;

const LINEAR = new Float64Array(256).map((_, value) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

const f = (t: number): number => (t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116);

/** Masks R18: sRGB 0-255 to CIE Lab under D65. */
export function rgbToLab(r: number, g: number, b: number): Lab {
  const lr = LINEAR[r]!;
  const lg = LINEAR[g]!;
  const lb = LINEAR[b]!;
  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / WHITE_X;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / WHITE_Z;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Masks R18: CIE76, the plain distance between two Lab colours. */
export function deltaE76(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Masks R10: "#RRGGBB" (the # is optional) to its three channels. */
export function hexToRgb(hex: string): [number, number, number] {
  const digits = hex.startsWith('#') ? hex.slice(1) : hex;
  const value = Number.parseInt(digits, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
