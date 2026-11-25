import { describe, expect, it } from 'vitest';
import { buildOwnerMap } from '../../../../src/generation/normal/height/buildOwnerMap';
import { smoothHeight } from '../../../../src/generation/normal/height/smoothHeight';
import { createReauthorCache, handleReauthorJob } from '../../../../src/generation/normal/reauthor/handleReauthorJob';
import { reauthorFromHeight } from '../../../../src/generation/normal/reauthor/reauthorFromHeight';
import { DEFAULT_PARAMS, type ReauthorParams } from '../../../../src/normalRecipe/reauthorParams';
import type { PixelPicture } from '../../../../src/generation/normal/uprightTypes';
import { twoWallsWithSeam } from './reauthorFixtures';

const SIDE = 128;
const mesh = twoWallsWithSeam();
const heightPicture = (): PixelPicture => {
  const rgba = new Uint8ClampedArray(SIDE * SIDE * 4);
  for (let y = 0; y < SIDE; y += 1) for (let x = 0; x < SIDE; x += 1) rgba.set([(x * 5) % 256, (x * 5) % 256, (x * 5) % 256, 255], (y * SIDE + x) * 4);
  return { side: SIDE, rgba };
};
const SHARP: ReauthorParams = { ...DEFAULT_PARAMS, sharpness: 1.4 };

describe('handleReauthorJob, the height path', () => {
  it('normal-height-edit R15 load answers loaded, then releases equal the one-shot function byte for byte and carry their job id', () => {
    const cache = createReauthorCache();
    expect(handleReauthorJob({ kind: 'load', jobId: 1, loadId: 4, baseHeight: heightPicture(), mesh }, cache)).toEqual({ kind: 'loaded', jobId: 1, loadId: 4 });
    const expected = reauthorFromHeight(smoothHeight(heightPicture(), buildOwnerMap(mesh, SIDE)), mesh, SHARP);
    for (const jobId of [2, 3]) {
      const response = handleReauthorJob({ kind: 'release', jobId, loadId: 4, params: SHARP }, cache);
      expect(response.kind).toBe('reauthor');
      if (response.kind !== 'reauthor') return;
      expect(response.jobId).toBe(jobId);
      expect(Array.from(response.pixels.rgba)).toEqual(Array.from(expected.rgba));
    }
  });

  it('normal-height-edit R15 a release for another loadId, or before any load, is refused as failed with its job id', () => {
    const cache = createReauthorCache();
    expect(handleReauthorJob({ kind: 'release', jobId: 9, loadId: 1, params: DEFAULT_PARAMS }, cache)).toMatchObject({ kind: 'failed', jobId: 9 });
    handleReauthorJob({ kind: 'load', jobId: 1, loadId: 1, baseHeight: heightPicture(), mesh }, cache);
    expect(handleReauthorJob({ kind: 'release', jobId: 10, loadId: 2, params: DEFAULT_PARAMS }, cache)).toMatchObject({ kind: 'failed', jobId: 10 });
  });

  it('normal-height-edit R15 a second load replaces the first, and close frees the cache', () => {
    const cache = createReauthorCache();
    handleReauthorJob({ kind: 'load', jobId: 1, loadId: 1, baseHeight: heightPicture(), mesh }, cache);
    handleReauthorJob({ kind: 'load', jobId: 2, loadId: 2, baseHeight: heightPicture(), mesh }, cache);
    expect(handleReauthorJob({ kind: 'release', jobId: 3, loadId: 1, params: DEFAULT_PARAMS }, cache).kind).toBe('failed');
    expect(handleReauthorJob({ kind: 'release', jobId: 4, loadId: 2, params: DEFAULT_PARAMS }, cache).kind).toBe('reauthor');
    expect(handleReauthorJob({ kind: 'close', loadId: 2 }, cache)).toEqual({ kind: 'closed', loadId: 2 });
    expect(cache.current).toBeNull();
    expect(handleReauthorJob({ kind: 'release', jobId: 5, loadId: 2, params: DEFAULT_PARAMS }, cache).kind).toBe('failed');
  });

  it('normal-height-edit R15 a load that cannot be built answers failed, not an exception, and leaves no cache', () => {
    const cache = createReauthorCache();
    const response = handleReauthorJob({ kind: 'load', jobId: 6, loadId: 1, baseHeight: { side: 1e9, rgba: new Uint8ClampedArray(4) }, mesh }, cache);
    expect(response).toMatchObject({ kind: 'failed', jobId: 6 });
    expect(cache.current).toBeNull();
  });

  it('normal-height-edit R15 params that are not clamped are clamped before use', () => {
    const cache = createReauthorCache();
    handleReauthorJob({ kind: 'load', jobId: 1, loadId: 1, baseHeight: heightPicture(), mesh }, cache);
    const response = handleReauthorJob({ kind: 'release', jobId: 2, loadId: 1, params: { slopeDeg: 500, seamRadius: -3, seamFlatten: Number.NaN, sharpness: 9 } }, cache);
    expect(response.kind).toBe('reauthor');
  });

  it('normal-height-edit R15 the legacy stateless request still works without a cache', () => {
    const response = handleReauthorJob({ kind: 'reauthor', jobId: 7, base: heightPicture(), mesh, params: DEFAULT_PARAMS });
    expect(response.kind).toBe('reauthor');
  });
});
