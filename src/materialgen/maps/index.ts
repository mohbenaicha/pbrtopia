// What the rest of the material app may use from the maps folder (materialgen app R1).
export { MAP_KINDS, SLOTS, isShownAsCard, kindsOfSlot, slotOfKind, type MapKind, type Slot } from './mapKinds';
export { MATERIAL_SIZES, type DerivedFromRecord, type MapRecord, type MapRecords, type MapSource, type MapUndoEntry, type MapsState, type MaterialSize } from './mapRecord';
export type { GpuResizer } from './resizeToSquareBlob';
export { withPendingMaps, type PendingMap, type PendingMaps } from './pendingMaps';
export { useMapsController,type BusyTarget, type MapsController, type MapsHost, type MapsMessage } from './useMapsController';
export type { ImageEdit } from './mapActions';
export { planCommitMasks, type MasksCommit } from './planCommitMasks';
export { planPlaceGenerated, type GeneratedMap } from './planPlaceGenerated';
export { readMapPixels } from './readMapPixels';
export { findEditedSlot } from './lastEditedSlot';
export { decodeImageFile, type DecodeOutcome } from './drop/decodeImageFile';
export { encodePng, type PixelImage } from './png/pngCodec';
export { encodePngBlob } from './png/pngOffThread';
export { resampleToSquare } from './pixels/resampleToSquare';
export { hasRoomFor, quotaMessage } from './commitMapOperation';
export { reportMissingFiles, type MissingFilesReport } from './missingFiles';
export { MapCard } from './ui/MapCard';
export { buildCardModel, kindLabel, type CardModel } from './ui/buildCardModel';
export type { MapCardActions } from './ui/MapHalf';
export {
  canUndo,
  changeSize,
  checkMapsInvariants,
  clearMap,
  editMaps,
  isStale,
  nearestMaterialSize,
  placeMap,
  referencedMapKeys,
  restoreOriginal,
  undoMaps,
  undoTargets,
  type EditGroup,
  type MapEdit,
  type PlacedMap,
} from './mapOperations';
