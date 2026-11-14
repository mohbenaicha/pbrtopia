/** What the brush paints with: the base material's flat values, in the bytes the app stores (R17, R20). */
export interface PaintMaterial {
  albedo: readonly [number, number, number]; // sRGB 0-255
  roughness: number; // 0-255
  metalness: number; // 0-255
}

/** Neutral values for a map the working copy does not have (R20). */
export const DEFAULT_MAP_BYTES = {
  albedo: [128, 128, 128, 255],
  orm: [255, 128, 0, 255],
  height: [128],
  normal: [128, 128, 255, 255],
} as const;

const toLinearByte = (byte: number): number => {
  const unit = Math.min(1, Math.max(0, byte / 255));
  return unit <= 0.04045 ? unit / 12.92 : Math.pow((unit + 0.055) / 1.055, 2.4);
};

/** Compositing R17: sRGB bytes to linear light, for the albedo target whose blend runs in linear light (A4.1). */
export function toLinearColour(colour: readonly [number, number, number]): [number, number, number] {
  return [toLinearByte(colour[0]), toLinearByte(colour[1]), toLinearByte(colour[2])];
}
