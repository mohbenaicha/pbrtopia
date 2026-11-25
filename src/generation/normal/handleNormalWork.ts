import { DEFAULT_PARAMS } from '../../normalRecipe/reauthorParams';
import type { RunError } from '../generateStore';
import { buildOwnerMap } from './height/buildOwnerMap';
import { readSheetHeight } from './height/readSheetHeight';
import { smoothHeight } from './height/smoothHeight';
import { unpackHeight } from './height/unpackHeight';
import { reauthorFromHeight } from './reauthor/reauthorFromHeight';
import type { Result } from '../providers/providerTypes';
import { buildUprightSheet } from './buildUprightSheet';
import type { PixelPicture, UprightSheet, UvMesh } from './uprightTypes';

export type NormalWorkRequest =
  | { kind: 'prepare'; source: PixelPicture; mesh: UvMesh }
  | { kind: 'finish'; height: PixelPicture; sheet: UprightSheet; mesh: UvMesh };
export type NormalWorkResponse =
  | { kind: 'prepare'; result: Result<UprightSheet, RunError> }
  | { kind: 'finish'; baseHeight: PixelPicture; normal: PixelPicture }; // normal-height-edit R12: the height as stored and the normal made from it at DEFAULT_PARAMS

/** normal-map R20, normal-height-edit R12: what the worker does for one request; a pure function of the request, so the worker and the tests share it. */
export function handleNormalWork(request: NormalWorkRequest): NormalWorkResponse {
  if (request.kind === 'prepare') return { kind: 'prepare', result: buildUprightSheet(request.source, request.mesh) };
  const owner = buildOwnerMap(request.mesh, request.sheet.picture.side);
  const baseHeight = unpackHeight(readSheetHeight(request.height), request.sheet, owner);
  return { kind: 'finish', baseHeight, normal: reauthorFromHeight(smoothHeight(baseHeight, owner), request.mesh, DEFAULT_PARAMS) };
}
