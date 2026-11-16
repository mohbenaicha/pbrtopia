import type { PainterMaps } from '../gpu/createStampPainter';
import { planApplyEdits, type ImageEdit, type MapPlan, type PlanIo } from '@mat/maps/mapActions';
import type { MapKind } from '@mat/maps/mapKinds';
import type { MapsState } from '@mat/maps/mapRecord';
import type { PixelImage } from '@mat/maps/png/pngCodec';
import type { PaintedBytes } from './createPaintSession';
import { greyFromImage, imageFromGrey, imageFromRgba, ormFromMaps, rgbaFromImage, splitOrm } from './pictureBytes';

/** The label of the undo entry each painted map gets (maps R16). */
export const PAINT_LABEL = 'Paint';

/** Compositing R17: the colour map painted is the albedo, or the diffuse when that is all the project has. */
export type ColourKind = 'albedo' | 'diffuse';

export interface LoadedPaintMaps {
  maps: PainterMaps;
  colourKind: ColourKind;
  /** Channel counts to store the painted colour and normal maps with, as the stored ones have them. */
  albedoChannels: 3 | 4;
  normalChannels: 3 | 4;
}

/** Compositing R20: the stored working maps as the painter's starting bytes; a map the project lacks is left out and starts flat. */
export async function loadPaintMaps(state: MapsState, readPixels: (key: string) => Promise<PixelImage | null>): Promise<LoadedPaintMaps> {
  const read = async (kind: MapKind): Promise<PixelImage | undefined> => {
    const record = state.maps[kind];
    return record === undefined ? undefined : (await readPixels(record.workingKey)) ?? undefined;
  };
  const colourKind: ColourKind = state.maps.albedo === undefined && state.maps.diffuse !== undefined ? 'diffuse' : 'albedo';
  const [colour, normal, height, ao, rough, metal] = await Promise.all([read(colourKind), read('normal'), read('height'), read('ao'), read('rough'), read('metal')]);
  const maps: PainterMaps = {};
  if (colour !== undefined) maps.albedo = rgbaFromImage(colour);
  if (normal !== undefined) maps.normal = rgbaFromImage(normal);
  if (height !== undefined) maps.height = greyFromImage(height);
  const packed = { ...(ao ? { ao } : {}), ...(rough ? { rough } : {}), ...(metal ? { metal } : {}) };
  const size = rough ?? metal ?? ao;
  if (size !== undefined) maps.orm = ormFromMaps(packed, size.width, size.height);
  return { maps, colourKind, albedoChannels: colour?.channels === 4 ? 4 : 3, normalChannels: normal?.channels === 4 ? 4 : 3 };
}

export interface PaintedPictures {
  colour?: PixelImage;
  rough?: PixelImage;
  metal?: PixelImage;
  height?: PixelImage;
  normal?: PixelImage;
}

/** Compositing R22 (A9 steps 1-3): the maps a session wrote as stored pictures; roughness and metal come out of the packed bytes. */
export function paintedPicturesOf(painted: Pick<PaintedBytes, 'albedo' | 'orm' | 'height' | 'normal' | 'applied'>, side: number, channels: { albedo: 3 | 4; normal: 3 | 4 }): PaintedPictures {
  const out: PaintedPictures = {};
  if (painted.applied.includes('albedo') && painted.albedo) out.colour = imageFromRgba(painted.albedo, side, side, channels.albedo);
  if (painted.orm) {
    const { rough, metal } = splitOrm(painted.orm, side, side);
    if (painted.applied.includes('rough')) out.rough = rough;
    if (painted.applied.includes('metal')) out.metal = metal;
  }
  if (painted.applied.includes('height') && painted.height) out.height = imageFromGrey(painted.height, side, side);
  if (painted.applied.includes('normal') && painted.normal) out.normal = imageFromRgba(painted.normal, side, side, channels.normal);
  return out;
}

/**
 * Compositing R22, R20: one commit. Each painted map becomes a new working file with its own undo entry (an existing map), all tied in one group, or a computed original (a map the
 * project lacked). Height painted leaves AO stale through its derivation record (maps R32). Nothing painted: the same state and no files.
 */
export async function planCommitPaint(state: MapsState, pictures: PaintedPictures, colourKind: ColourKind, io: Pick<PlanIo, 'newKey'>): Promise<MapPlan> {
  const edits: ImageEdit[] = [];
  if (pictures.colour) edits.push({ kind: colourKind, image: pictures.colour });
  if (pictures.rough) edits.push({ kind: 'rough', image: pictures.rough });
  if (pictures.metal) edits.push({ kind: 'metal', image: pictures.metal });
  if (pictures.height) edits.push({ kind: 'height', image: pictures.height });
  if (pictures.normal) edits.push({ kind: 'normal', image: pictures.normal });
  const result = await planApplyEdits(state, edits, PAINT_LABEL, true, io); // one group: a single Undo takes back the whole session on every map (R22)
  if (!result.ok) throw new Error(result.message);
  return result.plan;
}
