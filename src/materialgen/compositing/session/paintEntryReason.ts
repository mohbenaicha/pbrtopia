import { BRUSH_ATLAS_ERROR } from '../atlas/readBrushAtlas';

export interface PaintEntryFacts {
  size: number | null; // S; null while the project has no map
  canWrite: boolean;
  readOnlyReason: string;
  otherEditOpen: boolean; // another imageops session or running op
  mapsBusy: boolean;
  atlasFailed: boolean;
  previewReady: boolean;
}

/** Compositing R1, R36, R55: why the painter's entry is disabled, or undefined when it can open (the mesh is not a reason: opening switches to the Plane). */
export function paintEntryReason(facts: PaintEntryFacts): string | undefined {
  if (facts.size === null) return 'Add a map first';
  if (!facts.canWrite) return facts.readOnlyReason;
  if (facts.otherEditOpen) return 'Another edit is open. Apply or cancel it first.';
  if (facts.mapsBusy) return 'The maps are being changed.';
  if (facts.atlasFailed) return BRUSH_ATLAS_ERROR;
  if (!facts.previewReady) return 'The preview is not ready.';
  return undefined;
}
