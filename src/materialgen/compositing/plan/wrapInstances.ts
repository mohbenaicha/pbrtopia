export interface WrapSubject {
  x: number; // picture fraction, any real number (unwrapped)
  y: number;
  size: number;
}

export interface WrappedCentre {
  x: number;
  y: number;
}

const offsetsOf = (position: number, reach: number): number[] => {
  const offsets = [0];
  if (position - reach < 0) offsets.push(1);
  if (position + reach > 1) offsets.push(-1);
  return offsets;
};

/**
 * Compositing R16: the centres at which a stamp is drawn so that it continues across the picture's edges: its own centre reduced into 0..1, plus one copy
 * shifted by +-1 on each axis where the stamp's reach (half the diagonal of the rotated square) crosses that edge. One to four centres (more only for a
 * stamp larger than the picture).
 */
export function wrapInstances(stamp: WrapSubject): WrappedCentre[] {
  const x = stamp.x - Math.floor(stamp.x);
  const y = stamp.y - Math.floor(stamp.y);
  const reach = (stamp.size * Math.SQRT2) / 2;
  const centres: WrappedCentre[] = [];
  for (const dx of offsetsOf(x, reach)) for (const dy of offsetsOf(y, reach)) centres.push({ x: x + dx, y: y + dy });
  return centres;
}
