import { describe, expect, it } from 'vitest';
import { planChangeSize, type PlanIo } from '../../../src/materialgen/maps/mapActions';
import { editMaps, placeMap } from '../../../src/materialgen/maps/mapOperations';
import { decodePng, encodePng, type PixelImage } from '../../../src/materialgen/maps/png/pngCodec';

const solid = (side: number, value: number): PixelImage => ({ width: side, height: side, channels: 1, data: new Uint8Array(side * side).fill(value) });
const png = (image: PixelImage): Blob => new Blob([encodePng(image) as BlobPart], { type: 'image/png' });
const io = (files: Record<string, Blob>): PlanIo => {
  let counter = 0;
  return { readBlob: async (key) => files[key] ?? null, newKey: () => `n${(counter += 1)}`, label: () => 'Height' };
};
const baked = () => editMaps(placeMap({ size: 256, maps: {} }, 'height', { originalKey: 'h0', workingKey: 'h0', width: 256, height: 256 }), [{ kind: 'height', workingKey: 'h1', offsetBase: 'hb' }], 'Material masks');

describe('materialgen/maps planChangeSize with height offsets (masks R87)', () => {
  it('R87 the base of the height offsets is resampled with the map, the tag follows it and the group entry keeps the previous tag', async () => {
    const outcome = await planChangeSize(baked(), 512, io({ h1: png(solid(256, 164)), hb: png(solid(256, 100)) }));
    if (!outcome.ok) throw new Error(outcome.message);
    const height = outcome.plan.next.maps.height!;
    expect(outcome.plan.newBlobs.size).toBe(2); // the working map and its base
    const base = outcome.plan.newBlobs.get(height.offsetBase!)!;
    const image = decodePng(new Uint8Array(await base.arrayBuffer())) as PixelImage;
    expect([image.width, image.channels, image.data[0]]).toEqual([512, 1, 100]);
    expect(height.undo).toMatchObject({ offsetBase: 'hb', size: 256 });
  });

  it('R87 a base file that cannot be read stops the change of S with a message and changes nothing', async () => {
    const outcome = await planChangeSize(baked(), 512, io({ h1: png(solid(256, 164)) }));
    expect(outcome.ok).toBe(false);
  });
});
