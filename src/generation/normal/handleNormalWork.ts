import { clampReauthorParams } from '../../normalRecipe/clampReauthorParams';
import type { ReauthorParams } from '../../normalRecipe/reauthorParams';
import type { RunError } from '../generateStore';
import { reauthorNormal } from './reauthor/reauthorNormal';
import type { Result } from '../providers/providerTypes';
import { buildUprightSheet } from './buildUprightSheet';
import { deriveNormals } from './deriveNormals';
import { unpackNormals } from './unpackNormals';
import type { PixelPicture, UprightSheet, UvMesh } from './uprightTypes';

export type NormalWorkRequest =
  | { kind: 'prepare'; source: PixelPicture; mesh: UvMesh }
  | { kind: 'finish'; height: PixelPicture; sheet: UprightSheet }
  | { kind: 'reauthor'; base: PixelPicture; mesh: UvMesh; params: ReauthorParams }; // normal-reauthor R17: the picture a new run stores
export type NormalWorkResponse = { kind: 'prepare'; result: Result<UprightSheet, RunError> } | { kind: 'finish'; normals: PixelPicture } | { kind: 'reauthor'; pixels: PixelPicture };

/** normal-map R20: what the worker does for one request; a pure function of the request, so the worker and the tests share it. */
export function handleNormalWork(request: NormalWorkRequest): NormalWorkResponse {
  if (request.kind === 'prepare') return { kind: 'prepare', result: buildUprightSheet(request.source, request.mesh) };
  if (request.kind === 'reauthor') return { kind: 'reauthor', pixels: reauthorNormal(request.base, request.mesh, clampReauthorParams(request.params)) };
  return { kind: 'finish', normals: unpackNormals(deriveNormals(request.height, request.sheet), request.sheet) };
}
