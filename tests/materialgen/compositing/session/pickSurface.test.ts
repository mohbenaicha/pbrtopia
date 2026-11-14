import { describe, expect, it } from 'vitest';
import { createHeightProxy, pickSurface, type PickField } from '../../../../src/materialgen/compositing/session/pickSurface';

const flatField = (over: Partial<PickField> = {}): PickField => ({ height: () => 0.5, scale: 0, bias: 0, tilingX: 1, tilingY: 1, ...over });
const unit = (x: number, y: number, z: number): [number, number, number] => { const length = Math.hypot(x, y, z); return [x / length, y / length, z / length]; };

describe('materialgen/compositing surface pick (R27)', () => {
  it('R27 a ray straight down a flat plane hits the picture coordinate under it', () => {
    const hit = pickSurface([0.25, -0.25, 1], [0, 0, -1], flatField())!;
    expect(hit.x).toBeCloseTo(0.75, 6);
    expect(hit.y).toBeCloseTo(0.25, 6);
  });

  it('R27 a slanted ray on a flat plane hits where the plain plane intersection is', () => {
    const direction = unit(0.4, 0, -1);
    const hit = pickSurface([-0.2, 0, 1], direction, flatField())!;
    expect(hit.x).toBeCloseTo(-0.2 + 0.4 + 0.5, 5);
  });

  it('R27 on a raised surface the hit is where the ray meets the displaced height, not the flat plane', () => {
    // height 1 everywhere, scale 0.1, bias 0: the surface is the plane z = 0.1
    const direction = unit(1, 0, -1);
    const hit = pickSurface([-0.5, 0, 0.6], direction, flatField({ height: () => 1, scale: 0.1 }))!;
    // reaches z = 0.1 after dropping 0.5 while moving 0.5 in x: x = 0, picture x = 0.5
    expect(hit.x).toBeCloseTo(0.5, 2);
    expect(hit.x).not.toBeCloseTo(0.5 + 0.1, 2);
  });

  it('R27 tiling multiplies the picture coordinate of each axis separately', () => {
    const hit = pickSurface([0.25, -0.25, 1], [0, 0, -1], flatField({ tilingX: 2, tilingY: 4 }))!;
    expect(hit.x).toBeCloseTo(1.5, 6);
    expect(hit.y).toBeCloseTo(1, 6);
  });

  it('R27 a ray that misses the plane, or looks up, picks nothing', () => {
    expect(pickSurface([2, 0, 1], [0, 0, -1], flatField())).toBeNull();
    expect(pickSurface([0, 0, 1], [0, 0, 1], flatField())).toBeNull();
    expect(pickSurface([0, 0, 1], [1, 0, 0], flatField())).toBeNull();
  });

  it('R27 a ridge in the height is hit on its near side from a low angle', () => {
    // a wall of height 1 for u > 0.5, nothing below: from the left at a low angle the ray meets the wall's near edge
    const field = flatField({ height: (u) => (u - Math.floor(u) >= 0.5 ? 1 : 0), scale: 0.2, bias: 0 });
    const direction = unit(1, 0, -0.15);
    const hit = pickSurface([-0.5, 0, 0.1], direction, field)!;
    expect(hit.x).toBeGreaterThan(0.45);
    expect(hit.x).toBeLessThan(0.75);
  });
});

describe('materialgen/compositing height proxy (R26 R27)', () => {
  it('R27 the proxy reads bilinearly with wrap and texel centres at (i + 0.5) / side', () => {
    const proxy = createHeightProxy(Uint8Array.from([0, 255, 0, 255]), 2); // 2 x 2: columns 0 and 1 alternate
    expect(proxy(0.25, 0.25)).toBeCloseTo(0, 6);
    expect(proxy(0.75, 0.25)).toBeCloseTo(1, 6);
    expect(proxy(0.5, 0.25)).toBeCloseTo(0.5, 6);
    expect(proxy(1.25, 0.25)).toBeCloseTo(0, 6); // wraps
    expect(proxy(-0.25, 0.25)).toBeCloseTo(1, 6);
  });
});
