import { ORM_DEFAULTS, resampleToSquare, type PixelImage } from '@mat/workerapi';

/** Export R11: green becomes 255 - g (a DirectX normal from the stored OpenGL one); red and blue stay. A new picture; the input is untouched. */
export function flipNormalGreen(normal: PixelImage): PixelImage {
  const data = Uint8Array.from(normal.data);
  for (let at = 1; at < data.length; at += normal.channels) data[at] = 255 - data[at]!;
  return { ...normal, data };
}

export interface OrmPixelSources {
  ao?: PixelImage;
  rough?: PixelImage;
  metal?: PixelImage;
}

/**
 * Export R8: the packed ORM as an RGB picture, R = ao, G = roughness, B = metallic, each from the map's first channel; a missing map gives the shared
 * default (ORM_DEFAULTS). Null when none of the three exists, since then no file is written. The sources are all the same size.
 */
export function packOrmPixels(sources: OrmPixelSources): PixelImage | null {
  const reference = sources.ao ?? sources.rough ?? sources.metal;
  if (reference === undefined) return null;
  const count = reference.width * reference.height;
  const data = new Uint8Array(count * 3);
  const channels: Array<[PixelImage | undefined, number]> = [[sources.ao, ORM_DEFAULTS.ao], [sources.rough, ORM_DEFAULTS.rough], [sources.metal, ORM_DEFAULTS.metal]];
  channels.forEach(([map, fallback], channel) => {
    for (let pixel = 0; pixel < count; pixel += 1) data[pixel * 3 + channel] = map === undefined ? fallback : map.data[pixel * map.channels]!;
  });
  return { width: reference.width, height: reference.height, channels: 3, data };
}

/** Export R22: a map at a smaller side, by area average; a normal map is re-normalised. The same side returns the picture itself. */
export function resampleMapForExport(map: PixelImage, side: number, isNormal: boolean): PixelImage {
  return resampleToSquare(map, side, { normal: isNormal });
}

/** Export R23: labels at a smaller side by nearest neighbour; labels are never averaged. */
export function resampleLabelsNearest(labels: PixelImage, side: number): PixelImage {
  if (labels.width === side && labels.height === side) return labels;
  const data = new Uint8Array(side * side * labels.channels);
  for (let y = 0; y < side; y += 1) {
    const sourceY = Math.min(labels.height - 1, Math.floor(((y + 0.5) * labels.height) / side));
    for (let x = 0; x < side; x += 1) {
      const sourceX = Math.min(labels.width - 1, Math.floor(((x + 0.5) * labels.width) / side));
      for (let c = 0; c < labels.channels; c += 1) data[(y * side + x) * labels.channels + c] = labels.data[(sourceY * labels.width + sourceX) * labels.channels + c]!;
    }
  }
  return { width: side, height: side, channels: labels.channels, data };
}

const hexToBytes = (hex: string): [number, number, number] => {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

/** Export R23: an RGB picture where each pixel is the palette colour of its label (black for a label the palette lacks). */
export function labelsToPaletteRgb(labels: PixelImage, palette: ReadonlyArray<{ label: number; hex: string }>): PixelImage {
  const colours = new Map(palette.map((entry) => [entry.label, hexToBytes(entry.hex)] as const));
  const count = labels.width * labels.height;
  const data = new Uint8Array(count * 3);
  for (let pixel = 0; pixel < count; pixel += 1) {
    const colour = colours.get(labels.data[pixel * labels.channels]!);
    if (colour !== undefined) data.set(colour, pixel * 3);
  }
  return { width: labels.width, height: labels.height, channels: 3, data };
}
