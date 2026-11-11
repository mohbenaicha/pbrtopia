import { ORM_DEFAULTS, resampleToSquare, type PixelImage } from '@mat/workerapi';
import type { PreviewMaps } from './previewMaps';

/**
 * Preview R10, R11: the hidden packed texture as RGBA bytes, R = ao, G = rough, B = metal (each from the map's first channel), A = 255.
 * A missing map gives the shared default (imageops R46). Maps of different sizes are brought to the largest side first. Null when none of the three exists.
 */
export function packOrmBytes(maps: Pick<PreviewMaps, 'ao' | 'rough' | 'metal'>): { rgba: Uint8Array; side: number } | null {
  const present = [maps.ao, maps.rough, maps.metal].filter((map): map is PixelImage => map !== undefined);
  if (present.length === 0) return null;
  const side = Math.max(...present.map((map) => Math.max(map.width, map.height)));
  const squared = (map: PixelImage | undefined): PixelImage | undefined => (map === undefined || (map.width === side && map.height === side) ? map : resampleToSquare(map, side));
  const channels: Array<[PixelImage | undefined, number]> = [
    [squared(maps.ao), ORM_DEFAULTS.ao],
    [squared(maps.rough), ORM_DEFAULTS.rough],
    [squared(maps.metal), ORM_DEFAULTS.metal],
  ];
  const rgba = new Uint8Array(side * side * 4);
  channels.forEach(([map, fallback], channel) => {
    for (let pixel = 0; pixel < side * side; pixel += 1) rgba[pixel * 4 + channel] = map === undefined ? fallback : map.data[pixel * map.channels]!;
  });
  for (let pixel = 0; pixel < side * side; pixel += 1) rgba[pixel * 4 + 3] = 255;
  return { rgba, side };
}
