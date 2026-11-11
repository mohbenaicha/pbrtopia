import { describe, expect, it, vi } from 'vitest';
import { encodePng } from '@mat/workerapi';
import type { MapRecord, MapsState } from '@mat/maps';
import { createPreviewMapLoader } from '../../../../src/materialgen/preview/maps/createPreviewMapLoader';

const record = (key: string): MapRecord => ({ originalKey: `o-${key}`, workingKey: key, undoKey: null, width: 2, height: 2 });
const grey = (value: number) => encodePng({ width: 2, height: 2, channels: 1, data: new Uint8Array(4).fill(value) });
const blobOf = (value: number) => new Blob([grey(value) as Uint8Array<ArrayBuffer>], { type: 'image/png' });

function setup(files: Record<string, Blob | null>) {
  const readBlob = vi.fn(async (key: string) => files[key] ?? null);
  return { readBlob, loader: createPreviewMapLoader(readBlob) };
}

describe('materialgen/preview R19 R45 R46 R48 loading the working copies', () => {
  it('R19 decodes the working copy of every map the material has, by kind', async () => {
    const { loader } = setup({ a: blobOf(10), r: blobOf(20) });
    const state: MapsState = { size: 256, maps: { albedo: record('a'), rough: record('r') } };
    const maps = await loader.load(state);
    expect(Object.keys(maps).sort()).toEqual(['albedo', 'rough']);
    expect(maps.rough!.data[0]).toBe(20);
  });

  it('R19 a working copy that did not change is not read or decoded again, and keeps the very same picture', async () => {
    const { loader, readBlob } = setup({ a: blobOf(10) });
    const state: MapsState = { size: 256, maps: { albedo: record('a') } };
    const first = await loader.load(state);
    const second = await loader.load({ ...state, maps: { ...state.maps } });
    expect(readBlob).toHaveBeenCalledTimes(1);
    expect(second.albedo).toBe(first.albedo);
  });

  it('maps R71 a seeded picture is shown for its key with no read, and kept when the committed record carries that key', async () => {
    const { loader, readBlob } = setup({});
    const picture = { width: 2, height: 2, channels: 1 as const, data: new Uint8Array(4).fill(7) };
    loader.seed('new', picture);
    const first = await loader.load({ size: 256, maps: { albedo: record('new') } });
    const second = await loader.load({ size: 256, maps: { albedo: { ...record('new'), originalKey: 'o-other' } } });
    expect(first.albedo).toBe(picture);
    expect(second.albedo).toBe(picture);
    expect(readBlob).not.toHaveBeenCalled();
  });

  it('R19 a replaced working copy is read once and shown', async () => {
    const { loader, readBlob } = setup({ a: blobOf(10), b: blobOf(99) });
    await loader.load({ size: 256, maps: { albedo: record('a') } });
    const next = await loader.load({ size: 256, maps: { albedo: record('b') } });
    expect(next.albedo!.data[0]).toBe(99);
    expect(readBlob).toHaveBeenCalledTimes(2);
  });

  it('R48 a cleared map is absent from the result and its decoded picture is forgotten', async () => {
    const { loader, readBlob } = setup({ a: blobOf(10) });
    await loader.load({ size: 256, maps: { albedo: record('a') } });
    expect(await loader.load({ size: null, maps: {} })).toEqual({});
    await loader.load({ size: 256, maps: { albedo: record('a') } });
    expect(readBlob).toHaveBeenCalledTimes(2); // forgotten, so read again
  });

  it('R45 a file that is missing or will not decode shows that map as missing instead of failing the preview', async () => {
    const { loader } = setup({ a: new Blob(['not a png']) });
    const maps = await loader.load({ size: 256, maps: { albedo: record('a'), normal: record('gone') } });
    expect(maps).toEqual({});
  });

  it('R45 a read that fails shows that map as missing, the others still load, and the failure is not remembered', async () => {
    let failing = true;
    const readBlob = vi.fn(async (key: string) => {
      if (key === 'bad' && failing) throw new Error('read error');
      return blobOf(key === 'bad' ? 50 : 10);
    });
    const loader = createPreviewMapLoader(readBlob);
    const state: MapsState = { size: 256, maps: { albedo: record('a'), normal: record('bad') } };
    const first = await loader.load(state);
    expect(Object.keys(first)).toEqual(['albedo']);
    failing = false;
    const second = await loader.load({ ...state, maps: { ...state.maps } });
    expect(Object.keys(second).sort()).toEqual(['albedo', 'normal']);
  });
});
