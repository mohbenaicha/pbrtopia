import type { RunError } from '../generateStore';
import type { Result } from '../providers/providerTypes';
import { buildUprightSheet } from './buildUprightSheet';
import { deriveNormals } from './deriveNormals';
import { unpackNormals } from './unpackNormals';
import type { PixelPicture, UprightSheet, UvMesh } from './uprightTypes';

export type NormalWorkRequest = { kind: 'prepare'; source: PixelPicture; mesh: UvMesh } | { kind: 'finish'; height: PixelPicture; sheet: UprightSheet };
export type NormalWorkResponse = { kind: 'prepare'; result: Result<UprightSheet, RunError> } | { kind: 'finish'; normals: PixelPicture };

/** normal-map R20: what the worker does for one request; a pure function of the request, so the worker and the tests share it. */
export function handleNormalWork(request: NormalWorkRequest): NormalWorkResponse {
  if (request.kind === 'prepare') return { kind: 'prepare', result: buildUprightSheet(request.source, request.mesh) };
  return { kind: 'finish', normals: unpackNormals(deriveNormals(request.height, request.sheet), request.sheet) };
}
