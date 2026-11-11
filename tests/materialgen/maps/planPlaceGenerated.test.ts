import { describe, expect, it } from 'vitest';
import type { MapsState } from '@mat/maps';
import { planPlaceGenerated } from '@mat/maps/planPlaceGenerated';
import type { PixelImage } from '@mat/maps/png/pngCodec';

const solid = (side: number, channels: 1 | 3 | 4, value = 100): PixelImage => ({ width: side, height: side, channels, data: new Uint8Array(side * side * channels).fill(value) });
const keys = () => {
  let count = 0;
  return () => `key-${(count += 1)}`;
};
const empty: MapsState = { size: null, maps: {} };

describe('materialgen/maps R12 R13 R14 R15 placing generated maps', () => {
  it('R15 the first image placed sets S to the nearest allowed size of its longer side', async () => {
    const plan = await planPlaceGenerated(empty, [{ kind: 'albedo', image: solid(1000, 3) }], keys());
    expect(plan.next.size).toBe(1024);
  });

  it('R12 an image already S x S in the slot format is its own working copy, one file', async () => {
    const plan = await planPlaceGenerated(empty, [{ kind: 'albedo', image: solid(1024, 3) }], keys());
    const albedo = plan.next.maps.albedo!;
    expect(albedo.workingKey).toBe(albedo.originalKey);
    expect(plan.newBlobs.size).toBe(1);
    expect(albedo.source).toEqual({ kind: 'generated' });
  });

  it('R12 a tile of another size keeps its native original and gets a copy resampled to S', async () => {
    const plan = await planPlaceGenerated({ size: 256, maps: {} }, [{ kind: 'normal', image: solid(300, 3, 128) }], keys());
    const normal = plan.next.maps.normal!;
    expect(normal.workingKey).not.toBe(normal.originalKey);
    expect([normal.width, normal.height]).toEqual([300, 300]);
    expect(plan.newBlobs.size).toBe(2);
  });

  it('R51 Height is stored as one grey channel whatever came back', async () => {
    const plan = await planPlaceGenerated({ size: 256, maps: {} }, [{ kind: 'height', image: solid(256, 3, 90) }], keys());
    const blob = plan.newBlobs.get(plan.next.maps.height!.originalKey)!;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[25]).toBe(0); // PNG header: colour type 0 (grey) is byte 25
  });

  it('R42 several maps are placed in one plan, all or none, and S comes from the first', async () => {
    const plan = await planPlaceGenerated(empty, [{ kind: 'albedo', image: solid(512, 3) }, { kind: 'normal', image: solid(512, 3) }], keys());
    expect(plan.next.size).toBe(512);
    expect(Object.keys(plan.next.maps).sort()).toEqual(['albedo', 'normal']);
  });

  it('R13 R14 a regenerate replaces the original and clears the map undo', async () => {
    const newKey = keys();
    const first = await planPlaceGenerated({ size: 256, maps: {} }, [{ kind: 'albedo', image: solid(256, 3) }], newKey);
    const edited: MapsState = { size: 256, maps: { albedo: { ...first.next.maps.albedo!, undoKey: 'undo-1', undo: { label: 'Filter' } as never } } };
    const again = await planPlaceGenerated(edited, [{ kind: 'albedo', image: solid(256, 3, 50) }], newKey);
    expect(again.next.maps.albedo!.undoKey).toBeNull();
    expect(again.next.maps.albedo!.originalKey).not.toBe(first.next.maps.albedo!.originalKey);
  });
});
