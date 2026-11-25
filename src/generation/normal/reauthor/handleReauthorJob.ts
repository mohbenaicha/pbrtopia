// normal-reauthor R9, R11, R15: what the worker does for one job; a pure function of the request, so the worker and the tests share it.
import type { PixelPicture, UvMesh } from '../uprightTypes';
import { clampReauthorParams } from '../../../normalRecipe/clampReauthorParams';
import type { ReauthorParams } from '../../../normalRecipe/reauthorParams';
import { reauthorNormal } from './reauthorNormal';

export interface ReauthorJobRequest {
  kind: 'reauthor';
  jobId: number;
  base: PixelPicture;
  mesh: UvMesh;
  params: ReauthorParams;
}
export type ReauthorJobResponse = { kind: 'reauthor'; jobId: number; pixels: PixelPicture } | { kind: 'failed'; jobId: number; message: string };

export function handleReauthorJob(request: ReauthorJobRequest): ReauthorJobResponse {
  try {
    return { kind: 'reauthor', jobId: request.jobId, pixels: reauthorNormal(request.base, request.mesh, clampReauthorParams(request.params)) };
  } catch (error) {
    return { kind: 'failed', jobId: request.jobId, message: error instanceof Error ? error.message : 'The normal map could not be updated.' };
  }
}
