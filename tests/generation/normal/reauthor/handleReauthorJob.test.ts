import { describe, expect, it } from 'vitest';
import { handleReauthorJob } from '../../../../src/generation/normal/reauthor/handleReauthorJob';
import { reauthorNormal } from '../../../../src/generation/normal/reauthor/reauthorNormal';
import { DEFAULT_PARAMS } from '../../../../src/normalRecipe/reauthorParams';
import { encodeNormal, solidPicture, twoWallsWithSeam } from './reauthorFixtures';

describe('handleReauthorJob', () => {
  const base = solidPicture(128, encodeNormal(0.5, 0.1, 0.86));
  const mesh = twoWallsWithSeam();

  it('normal-reauthor R9 the worker answer equals the direct call byte for byte and carries the job id', () => {
    const response = handleReauthorJob({ kind: 'reauthor', jobId: 7, base, mesh, params: DEFAULT_PARAMS });
    expect(response.kind).toBe('reauthor');
    if (response.kind !== 'reauthor') return;
    expect(response.jobId).toBe(7);
    expect(Array.from(response.pixels.rgba)).toEqual(Array.from(reauthorNormal(base, mesh, DEFAULT_PARAMS).rgba));
  });

  it('normal-reauthor R15 a request that throws answers failed with the same job id and does not throw', () => {
    // a side too large to allocate makes the first buffer throw; the answer must still be a message, not an exception
    const response = handleReauthorJob({ kind: 'reauthor', jobId: 3, base: { side: 1e9, rgba: new Uint8ClampedArray(4) }, mesh, params: DEFAULT_PARAMS });
    expect(response.kind).toBe('failed');
    expect(response.jobId).toBe(3);
    if (response.kind === 'failed') expect(response.message.length).toBeGreaterThan(0);
  });

  it('normal-reauthor R15 params that are not clamped are clamped before use, so a stale message cannot crash the worker', () => {
    const response = handleReauthorJob({ kind: 'reauthor', jobId: 1, base, mesh, params: { slopeDeg: 500, seamRadius: -3, seamFlatten: Number.NaN } });
    expect(response.kind).toBe('reauthor');
  });
});
