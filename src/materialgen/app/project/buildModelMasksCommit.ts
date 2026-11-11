import type { PixelImage } from '@mat/imageops';
import type { MapsState, MasksCommit } from '@mat/maps';
import type { MasksBuild } from '@mat/masks';

const UNDO_LABEL = 'Material masks';

/**
 * Masks R64, R66, R86: what a model run puts into the maps: the new labels (the decomposition picture as their original), the bake, and, because a run
 * sets every height offset to 0, the Height map back to the base it was made from when it was made by the offsets (R84), all in one commit.
 */
export function buildModelMasksCommit(state: MapsState, build: Pick<MasksBuild, 'labels' | 'bake'>, original: PixelImage, albedoKey: string): MasksCommit {
  const base = state.maps.height?.offsetBase;
  return {
    labels: { original, working: build.labels, derivedFrom: { kind: state.maps.albedo !== undefined ? 'albedo' : 'diffuse', key: albedoKey } },
    bake: build.bake,
    ...(base === undefined ? {} : { height: { backTo: base } }),
    label: UNDO_LABEL,
  };
}
