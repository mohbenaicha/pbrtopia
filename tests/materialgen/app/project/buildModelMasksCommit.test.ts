import { describe, expect, it } from 'vitest';
import type { PixelImage } from '@mat/imageops';
import type { MapsState } from '@mat/maps';
import { buildModelMasksCommit } from '../../../../src/materialgen/app/project/buildModelMasksCommit';

const grey = (value: number): PixelImage => ({ width: 2, height: 2, channels: 1, data: new Uint8Array(4).fill(value) });
const build = { labels: grey(1), bake: { rough: grey(2), metal: grey(3) } };
const mapsWith = (height?: MapsState['maps']['height']): MapsState => ({
  size: 1024,
  maps: { albedo: { originalKey: 'a', workingKey: 'a', undoKey: null, width: 1024, height: 1024 }, ...(height === undefined ? {} : { height }) },
});

describe('materialgen/app buildModelMasksCommit (masks R66 R86)', () => {
  it('R64 R66 the labels (with the picture as their original), the bake and the undo label go into one commit', () => {
    const commit = buildModelMasksCommit(mapsWith(), build, grey(9), 'a');
    expect(commit.label).toBe('Material masks');
    expect(commit.labels).toMatchObject({ original: grey(9), working: build.labels, derivedFrom: { kind: 'albedo', key: 'a' } });
    expect(commit.bake).toBe(build.bake);
    expect(commit.height).toBeUndefined();
  });

  it('R86 a re-run resets every offset to 0, so a Height made from a base goes back to it in the same commit', () => {
    const tagged = { originalKey: 'h0', workingKey: 'h1', undoKey: 'h0', undo: { label: 'Material masks' }, width: 1024, height: 1024, offsetBase: 'hb' };
    expect(buildModelMasksCommit(mapsWith(tagged), build, grey(9), 'a').height).toEqual({ backTo: 'hb' });
  });

  it('R86 an untagged Height is left alone', () => {
    const plain = { originalKey: 'h0', workingKey: 'h0', undoKey: null, width: 1024, height: 1024 };
    expect(buildModelMasksCommit(mapsWith(plain), build, grey(9), 'a').height).toBeUndefined();
  });

  it('R64 a diffuse colour map is named as the source when there is no albedo', () => {
    const state: MapsState = { size: 1024, maps: { diffuse: { originalKey: 'd', workingKey: 'd', undoKey: null, width: 1024, height: 1024 } } };
    expect(buildModelMasksCommit(state, build, grey(9), 'd').labels?.derivedFrom).toEqual({ kind: 'diffuse', key: 'd' });
  });
});
