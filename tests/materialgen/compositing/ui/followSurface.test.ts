import { describe, expect, it } from 'vitest';
import { followSurface } from '@mat/compositing/ui/followSurface';

function recorder(tiling: { tilingX: number; tilingY: number }) {
  const calls: string[] = [];
  return {
    calls,
    follow: {
      surface: () => tiling,
      setGhostTiling: (x: number, y: number) => void calls.push(`tiling ${x} ${y}`),
      placeMarker: () => void calls.push('marker'),
      repickGhost: () => void calls.push('repick'),
      showGhost: () => void calls.push('show'),
    },
  };
}

describe('materialgen/compositing ghost follows the surface (R56)', () => {
  it('R56 a values change gives the ghost the tiling of now, then places the marker, picks afresh, and only then shows the ghost', () => {
    const { calls, follow } = recorder({ tilingX: 3, tilingY: 2 });
    followSurface(follow);
    expect(calls).toEqual(['tiling 3 2', 'marker', 'repick', 'show']);
  });

  it('R56 each change reads the tiling again, so a second change is not the first one repeated', () => {
    const tiling = { tilingX: 1, tilingY: 1 };
    const { calls, follow } = recorder(tiling);
    followSurface(follow);
    tiling.tilingX = 7;
    tiling.tilingY = 4;
    followSurface(follow);
    expect(calls.filter((call) => call.startsWith('tiling'))).toEqual(['tiling 1 1', 'tiling 7 4']);
  });
});
