// What code that runs in a Web Worker may use from the maps and imageops folders. A worker has no document, so it must never reach a React
// component or a stylesheet, and the folders' own barrels carry both. This is the one place that reaches into those folders by file, and
// it re-exports only picture and record code with no drawing in it (export R32; tests/materialgen/lint/workerReach.test.ts keeps it so).
export { kindLabel } from '../maps/ui/buildCardModel';
export { isStale } from '../maps/mapOperations';
export { encodePng, decodePng, type PixelImage } from '../maps/png/pngCodec';
export { resampleToSquare } from '../maps/pixels/resampleToSquare';
export { readMapPixels } from '../maps/readMapPixels';
export { ORM_DEFAULTS } from '../imageops/pack/ormPack';
export type { MapKind } from '../maps/mapKinds';
export type { MapsState } from '../maps/mapRecord';
export type { MasksRecord, PaletteEntry } from '@shared/materialMasks';
