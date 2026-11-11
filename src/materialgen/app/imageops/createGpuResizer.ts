import { editKindOf } from '@mat/imageops';
import type { GpuResizer } from '@mat/maps';
import type { GeometryOps } from './useImageopsSessions';

/** Maps R27: the host's graphics-card resizer, the imageops scale op applied to the whole picture. Labels are not resampled by it. */
export function createGpuResizer(geometry: Pick<GeometryOps, 'crop'>): GpuResizer {
  return async (image, kind, side) => {
    const editKind = editKindOf(kind);
    if (editKind === null) throw new Error(`${kind} is not resampled on the graphics card`);
    return geometry.crop(image, editKind, { x: 0, y: 0, width: image.width, height: image.height }, side);
  };
}
