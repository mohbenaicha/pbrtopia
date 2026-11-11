import type { MapsState } from './mapRecord';

/**
 * Masks R83: the Height map a height-offset commit starts from: the one the working Height was computed from when it carries a tag, else the
 * working Height itself (it was placed, filtered or restored since, so it is not one of ours). Undefined with no Height map.
 */
export function heightBaseKey(state: MapsState): string | undefined {
  const height = state.maps.height;
  return height === undefined ? undefined : (height.offsetBase ?? height.workingKey);
}
