// normal-reauthor R9, R11, R15 and normal-height-edit R15: what the panel worker does for one request; a function of (cache, request), so the worker and the tests share it.
// Two kinds of picture: a legacy one (a base normal) uses the stateless `reauthor` request; a height one is loaded once (`load`) and re-authored many times (`release`).
import type { PixelPicture, UvMesh } from '../uprightTypes';
import { clampReauthorParams } from '../../../normalRecipe/clampReauthorParams';
import type { ReauthorParams } from '../../../normalRecipe/reauthorParams';
import { buildOwnerMap } from '../height/buildOwnerMap';
import { smoothHeight } from '../height/smoothHeight';
import { createHeightReauthorer, type HeightReauthorer } from './reauthorFromHeight';
import { reauthorNormal } from './reauthorNormal';

export interface LegacyReauthorRequest {
  kind: 'reauthor';
  jobId: number;
  base: PixelPicture;
  mesh: UvMesh;
  params: ReauthorParams;
}
export interface LoadHeightRequest {
  kind: 'load';
  jobId: number;
  loadId: number;
  baseHeight: PixelPicture;
  mesh: UvMesh;
}
export interface ReleaseHeightRequest {
  kind: 'release';
  jobId: number;
  loadId: number;
  params: ReauthorParams;
}
export interface CloseHeightRequest {
  kind: 'close';
  loadId: number;
}
export type ReauthorJobRequest = LegacyReauthorRequest | LoadHeightRequest | ReleaseHeightRequest | CloseHeightRequest;

export type ReauthorJobResponse =
  | { kind: 'reauthor'; jobId: number; pixels: PixelPicture }
  | { kind: 'loaded'; jobId: number; loadId: number }
  | { kind: 'closed'; loadId: number }
  | { kind: 'failed'; jobId: number; message: string };

/** What a worker keeps between requests: the one loaded height picture (R15), or nothing. */
export interface ReauthorCache {
  current: { loadId: number; reauthorer: HeightReauthorer } | null;
}
export const createReauthorCache = (): ReauthorCache => ({ current: null });

const failure = (jobId: number, error: unknown): ReauthorJobResponse => ({ kind: 'failed', jobId, message: error instanceof Error ? error.message : 'The normal map could not be updated.' });

function loadHeight(request: LoadHeightRequest, cache: ReauthorCache): ReauthorJobResponse {
  cache.current = null; // a failed load leaves nothing behind, and a new load replaces the old one
  const owner = buildOwnerMap(request.mesh, request.baseHeight.side);
  const reauthorer = createHeightReauthorer(smoothHeight(request.baseHeight, owner), request.mesh);
  reauthorer.prepare(); // the Sharpness deltas are paid here, once, so no release pays for them
  cache.current = { loadId: request.loadId, reauthorer };
  return { kind: 'loaded', jobId: request.jobId, loadId: request.loadId };
}

export function handleReauthorJob(request: ReauthorJobRequest, cache: ReauthorCache = createReauthorCache()): ReauthorJobResponse {
  const jobId = request.kind === 'close' ? 0 : request.jobId;
  try {
    switch (request.kind) {
      case 'reauthor':
        return { kind: 'reauthor', jobId, pixels: reauthorNormal(request.base, request.mesh, clampReauthorParams(request.params)) };
      case 'load':
        return loadHeight(request, cache);
      case 'release': {
        if (cache.current === null || cache.current.loadId !== request.loadId) return { kind: 'failed', jobId, message: 'The normal map is not loaded.' };
        return { kind: 'reauthor', jobId, pixels: cache.current.reauthorer.reauthor(clampReauthorParams(request.params)) };
      }
      case 'close':
        if (cache.current?.loadId === request.loadId) cache.current = null;
        return { kind: 'closed', loadId: request.loadId };
    }
  } catch (error) {
    return failure(jobId, error);
  }
}
