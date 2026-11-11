import { ImageTooLargeError, editKindOf, type EditMapKind, type PixelImage } from '@mat/imageops';
import type { ImageEdit, MapKind, MapsState } from '@mat/maps';

export interface GeometryPorts {
  /** The decoded working copy of a map, or null when its file is missing. */
  readPixels(key: string): Promise<PixelImage | null>;
  /** The op on one map, as the kind it is (a normal map is treated as a normal map). */
  transform(image: PixelImage, kind: EditMapKind): Promise<PixelImage>;
  applyEdits(edits: readonly ImageEdit[], label: string, grouped: boolean): Promise<boolean>;
}

export interface GeometryOpRequest {
  state: MapsState;
  label: string; // the undo label: Crop, Mirror, Swap diagonals
  kindLabel(kind: MapKind): string;
  ports: GeometryPorts;
}

export type GeometryOpResult = { ok: true } | { ok: false; message?: string };

const GRAPHICS_FAILED = 'Could not apply (graphics error). Nothing changed.';

/**
 * Imageops R11, R12, R31, R35: runs a geometry op over every map that is edited as a picture (not `labels`) and commits the results as one
 * grouped edit. Nothing is committed unless every map succeeded.
 */
export async function applyGeometryOp({ state, label, kindLabel, ports }: GeometryOpRequest): Promise<GeometryOpResult> {
  const targets = (Object.keys(state.maps) as MapKind[]).flatMap((kind) => {
    const map = state.maps[kind];
    const editKind = editKindOf(kind);
    return map === undefined || editKind === null ? [] : [{ kind, editKind, key: map.workingKey }];
  });
  const edits: ImageEdit[] = [];
  for (const { kind, editKind, key } of targets) {
    const pixels = await ports.readPixels(key);
    if (pixels === null) return { ok: false, message: `${kindLabel(kind)}: the file cannot be read.` };
    try {
      edits.push({ kind, image: await ports.transform(pixels, editKind) });
    } catch (error) {
      return { ok: false, message: error instanceof ImageTooLargeError ? error.message : GRAPHICS_FAILED };
    }
  }
  if (edits.length === 0) return { ok: true };
  return (await ports.applyEdits(edits, label, true)) ? { ok: true } : { ok: false }; // the controller has already said why
}
