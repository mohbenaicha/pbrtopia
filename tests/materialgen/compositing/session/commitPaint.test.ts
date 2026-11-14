import { describe, expect, it } from 'vitest';
import type { MapsState } from '../../../../src/materialgen/maps';
import { decodePng, type PixelImage } from '../../../../src/materialgen/maps/png/pngCodec';
import { loadPaintMaps, paintedPicturesOf, planCommitPaint } from '../../../../src/materialgen/compositing/session/commitPaint';

const grey = (value: number): PixelImage => ({ width: 2, height: 2, channels: 1, data: new Uint8Array(4).fill(value) });
const rgb = (r: number, g: number, b: number): PixelImage => ({ width: 2, height: 2, channels: 3, data: Uint8Array.from([r, g, b, r, g, b, r, g, b, r, g, b]) });
const record = (key: string) => ({ originalKey: key, workingKey: key, undoKey: null, width: 2, height: 2 });
const io = () => { let counter = 0; return { newKey: () => `n${(counter += 1)}` }; };

describe('materialgen/compositing loading the maps (R20)', () => {
  it('R20 stored maps become the painter byte layout; a map that is not there is left to the flat default', async () => {
    const state: MapsState = { size: 256, maps: { albedo: record('a'), rough: record('r'), height: record('h') } };
    const images: Record<string, PixelImage> = { a: rgb(1, 2, 3), r: grey(77), h: grey(9) };
    const loaded = await loadPaintMaps(state, async (key) => images[key] ?? null);
    expect(loaded.colourKind).toBe('albedo');
    expect(Array.from(loaded.maps.albedo!.subarray(0, 4))).toEqual([1, 2, 3, 255]);
    expect(Array.from(loaded.maps.orm!.subarray(0, 4))).toEqual([255, 77, 0, 255]);
    expect(Array.from(loaded.maps.height!)).toEqual([9, 9, 9, 9]);
    expect(loaded.maps.normal).toBeUndefined();
    expect(loaded.albedoChannels).toBe(3);
  });

  it('R17 with no albedo but a diffuse map, the diffuse is the colour map', async () => {
    const state: MapsState = { size: 256, maps: { diffuse: record('d') } };
    const loaded = await loadPaintMaps(state, async () => rgb(5, 6, 7));
    expect(loaded.colourKind).toBe('diffuse');
    expect(loaded.maps.orm).toBeUndefined();
  });
});

describe('materialgen/compositing commit (R22 R20)', () => {
  const bytes = {
    albedo: Uint8Array.from([9, 8, 7, 255, 9, 8, 7, 255, 9, 8, 7, 255, 9, 8, 7, 255]),
    orm: Uint8Array.from([255, 40, 50, 255, 255, 40, 50, 255, 255, 40, 50, 255, 255, 40, 50, 255]),
    applied: ['albedo', 'rough', 'metal'] as ('albedo' | 'rough' | 'metal' | 'height' | 'normal')[],
  };

  it('R22 the pictures cover exactly the applied maps: roughness and metal split from the packed bytes', () => {
    const pictures = paintedPicturesOf(bytes, 2, { albedo: 3, normal: 3 });
    expect(Object.keys(pictures).sort()).toEqual(['colour', 'metal', 'rough']);
    expect(pictures.colour).toMatchObject({ channels: 3, width: 2 });
    expect(Array.from(pictures.rough!.data)).toEqual([40, 40, 40, 40]);
    expect(Array.from(pictures.metal!.data)).toEqual([50, 50, 50, 50]);
  });

  it('R22 each painted map gets a new working file and its own undo entry, in one commit', async () => {
    const state: MapsState = { size: 256, maps: { albedo: record('a'), rough: record('r') } };
    const pictures = paintedPicturesOf(bytes, 2, { albedo: 3, normal: 3 });
    const plan = await planCommitPaint(state, pictures, 'albedo', io());
    expect(plan.newBlobs.size).toBe(3);
    expect(plan.next.maps.albedo).toMatchObject({ undoKey: 'a', undo: { label: 'Paint' } });
    expect(plan.next.maps.rough).toMatchObject({ undoKey: 'r', undo: { label: 'Paint' } });
    expect(plan.next.maps.albedo!.workingKey).not.toBe('a');
  });

  it('R20 a map that did not exist is made from the painting and becomes its own original', async () => {
    const state: MapsState = { size: 256, maps: { albedo: record('a') } };
    const plan = await planCommitPaint(state, paintedPicturesOf(bytes, 2, { albedo: 3, normal: 3 }), 'albedo', io());
    const metal = plan.next.maps.metal!;
    expect(metal.originalKey).toBe(metal.workingKey);
    expect(metal.undoKey).toBeNull();
    const blob = [...plan.newBlobs.entries()].find(([key]) => key === metal.workingKey)![1];
    const decoded = decodePng(new Uint8Array(await blob.arrayBuffer())) as PixelImage;
    expect(Array.from(decoded.data)).toEqual([50, 50, 50, 50]);
  });

  it('R17 a diffuse-only project paints the diffuse map', async () => {
    const state: MapsState = { size: 256, maps: { diffuse: record('d') } };
    const plan = await planCommitPaint(state, paintedPicturesOf(bytes, 2, { albedo: 3, normal: 3 }), 'diffuse', io());
    expect(plan.next.maps.diffuse).toMatchObject({ undoKey: 'd' });
    expect(plan.next.maps.albedo).toBeUndefined();
  });

  it('R22 a session with no applied stroke writes nothing', async () => {
    const state: MapsState = { size: 256, maps: { albedo: record('a') } };
    const plan = await planCommitPaint(state, paintedPicturesOf({ applied: [] }, 2, { albedo: 3, normal: 3 }), 'albedo', io());
    expect(plan.next).toBe(state);
    expect(plan.newBlobs.size).toBe(0);
  });
});
