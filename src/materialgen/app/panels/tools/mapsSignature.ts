import type { MapKind, MapsState } from '@mat/maps';

/** The working keys of every map and the side, joined: changes when anything under an open panel changes (imageops R61, compositing R40). */
export const mapsSignature = (state: MapsState): string =>
  `${state.size ?? ''}|${(Object.keys(state.maps) as MapKind[]).map((kind) => `${kind}:${state.maps[kind]?.workingKey ?? ''}`).join(',')}`;
