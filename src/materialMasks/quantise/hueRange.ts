import { hexToRgb } from '../color/lab';

/** Masks R18: a pixel is chromatic when its saturation and value reach these (a proposal); otherwise it is grey. */
export const MIN_CHROMATIC_SATURATION = 0.25;
export const MIN_CHROMATIC_VALUE = 0.2;
/** Masks R18: the hue distance (degrees) and value distances that count as one unit of cost (proposals). */
const HUE_UNIT = 30;
const CHROMATIC_VALUE_UNIT = 0.4;
const GREY_VALUE_UNIT = 0.3;

export interface HueEntry {
  hue: number; // degrees, 0 to 360
  value: number; // 0 to 1
  chromatic: boolean;
}

/** Hue (degrees), saturation and value (both 0 to 1) of an sRGB colour; the hue of a colour without saturation is 0. */
export function rgbToHsv(r: number, g: number, b: number): { hue: number; saturation: number; value: number } {
  const max = Math.max(r, g, b);
  const spread = max - Math.min(r, g, b);
  let hue = 0;
  if (spread > 0) {
    if (max === r) hue = ((g - b) / spread) % 6;
    else if (max === g) hue = (b - r) / spread + 2;
    else hue = (r - g) / spread + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { hue, saturation: max === 0 ? 0 : spread / max, value: max / 255 };
}

/** Masks R18: the palette colours as hue entries, in label order. */
export function toHueEntries(palette: ReadonlyArray<{ hex: string }>): HueEntry[] {
  return palette.map(({ hex }) => {
    const { hue, saturation, value } = rgbToHsv(...hexToRgb(hex));
    return { hue, value, chromatic: saturation >= MIN_CHROMATIC_SATURATION && value >= MIN_CHROMATIC_VALUE };
  });
}

function nearestOfKind(entries: ReadonlyArray<HueEntry>, chromatic: boolean, hue: number, value: number): { label: number; cost: number } {
  let label = -1;
  let cost = Infinity;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    if (entry.chromatic !== chromatic) continue;
    const apart = Math.abs(hue - entry.hue);
    const hueDistance = Math.min(apart, 360 - apart) / HUE_UNIT;
    const valueDistance = (value - entry.value) / (chromatic ? CHROMATIC_VALUE_UNIT : GREY_VALUE_UNIT);
    const candidate = (chromatic ? hueDistance * hueDistance : 0) + valueDistance * valueDistance;
    if (candidate < cost) {
      cost = candidate;
      label = index;
    }
  }
  return { label, cost };
}

/**
 * Masks R18: the label of the palette entry nearest in hue range to a colour. A chromatic colour is matched to the chromatic entries by hue
 * distance and value, a grey one to the grey entries by value; with no entry of its kind the other kind is used. A tie goes to the lowest label.
 */
export function labelByHueRange(entries: ReadonlyArray<HueEntry>, r: number, g: number, b: number): number {
  const { hue, saturation, value } = rgbToHsv(r, g, b);
  const chromatic = saturation >= MIN_CHROMATIC_SATURATION && value >= MIN_CHROMATIC_VALUE;
  const own = nearestOfKind(entries, chromatic, hue, value);
  return own.label >= 0 ? own.label : nearestOfKind(entries, !chromatic, hue, value).label;
}
