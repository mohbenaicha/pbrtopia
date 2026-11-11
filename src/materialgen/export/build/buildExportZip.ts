import { zipSync, type Zippable } from 'fflate';
import { encodePng, kindLabel, type MapKind, type MapsState, type MasksRecord, type PixelImage } from '@mat/workerapi';
import { flipNormalGreen, labelsToPaletteRgb, packOrmPixels, resampleLabelsNearest, resampleMapForExport } from '../pixels/exportPixels';
import { buildMaterialJson, normalConventionFor } from '../plan/buildMaterialJson';
import { storedKindOf, type ExportOptions, type ExportPlan } from '../plan/planExport';
import type { ExportKind } from '../names/exportNames';
import { buildMasksJson } from './buildMasksJson';

export interface ExportProgress {
  text: string; // "Encoding normal"
  done: number; // the step being worked on, from 1
  total: number;
}

export interface BuildExportInput {
  plan: ExportPlan;
  options: ExportOptions;
  projectName: string;
  colorMode: 'albedo' | 'diffuse';
  state: MapsState;
  preview: { tilingX: number; tilingY: number; heightScale: number; heightLevel: number };
  masks: MasksRecord | null;
  app: { name: string; version: string };
  now: () => string;
  /** The target's import script (export R14, R17), or none (Substance Painter, generic). */
  script: { fileName: string; text: string } | null;
  /** Decodes a map's working copy as pixels; null when the file is missing or unreadable (export R29, R30). */
  readMap(kind: MapKind): Promise<PixelImage | null>;
  onProgress?: (step: ExportProgress) => void;
  signal?: AbortSignal;
}

/** Export R30: a map whose working copy could not be read; the message names the map. */
export class ExportReadError extends Error {
  constructor(map: string) {
    super(`${map}: the file cannot be read, so nothing was exported.`);
    this.name = 'ExportReadError';
  }
}

const abortError = (): Error => Object.assign(new Error('The export was cancelled.'), { name: 'AbortError' });
const encoder = new TextEncoder();
const GREY_KINDS: readonly ExportKind[] = ['height', 'roughness', 'metallic', 'ao'];
const ZIP_LEVEL = 6; // proposal (export R31)

/** The first channel as a one-channel picture (export R6: height, roughness, metallic and ao are grey files). */
function toGrey(image: PixelImage): PixelImage {
  if (image.channels === 1) return image;
  const count = image.width * image.height;
  const data = new Uint8Array(count);
  for (let pixel = 0; pixel < count; pixel += 1) data[pixel] = image.data[pixel * image.channels]!;
  return { width: image.width, height: image.height, channels: 1, data };
}

/** The colour channels only, as an RGB picture (export R6: albedo and normal carry no alpha). */
function toRgb(image: PixelImage): PixelImage {
  if (image.channels === 3) return image;
  const count = image.width * image.height;
  const data = new Uint8Array(count * 3);
  for (let pixel = 0; pixel < count; pixel += 1) {
    const at = pixel * image.channels;
    for (let c = 0; c < 3; c += 1) data[pixel * 3 + c] = image.data[image.channels === 1 ? at : at + c]!;
  }
  return { width: image.width, height: image.height, channels: 3, data };
}

const pngBytes = (image: PixelImage): Uint8Array => encodePng(image);

/**
 * Export R6-R12, R22-R23, R29-R31, R33: reads the planned maps one at a time, writes each in its file format (resampled, normal flipped for the
 * target, ORM packed, labels in palette colours), and zips them in the fixed order behind `material.json`. Nothing is returned when a map cannot
 * be read or the export is cancelled. Reads and writes no project data.
 */
export async function buildExportZip(input: BuildExportInput): Promise<{ bytes: Uint8Array; fileName: string }> {
  const { plan, options, signal } = input;
  const checkCancelled = (): void => {
    if (signal?.aborted) throw abortError();
  };
  const total = plan.files.length;
  // Each stored map is read, converted and resampled at the moment it is needed and not kept: the plan lists a map once, so a decoded map is
  // released as soon as its file (or its channel of the packed file) is made (export R32: at most two decoded maps at once).
  const load = async (kind: ExportKind): Promise<PixelImage> => {
    const stored = kind === 'labels' ? 'labels' : storedKindOf(input.state, kind);
    if (stored === undefined) throw new ExportReadError(kind);
    const image = await input.readMap(stored);
    if (image === null) throw new ExportReadError(kindLabel(stored, input.colorMode));
    return image;
  };
  // Converted first, so a file with an alpha channel resamples (a normal map refuses alpha) and a grey map is resampled as one channel.
  const sized = async (kind: ExportKind, convert: (image: PixelImage) => PixelImage): Promise<PixelImage> => resampleMapForExport(convert(await load(kind)), options.size, kind === 'normal');
  const greyAtSize = (kind: ExportKind): Promise<PixelImage> => sized(kind, toGrey);

  const entries: Zippable = {};
  // The zip format stores a local clock time with no zone; fflate reads the local getters, so the UTC fields go in as local ones and the bytes do not depend on the machine's zone (R31).
  const exported = new Date(input.now());
  const mtime = new Date(exported.getUTCFullYear(), exported.getUTCMonth(), exported.getUTCDate(), exported.getUTCHours(), exported.getUTCMinutes(), exported.getUTCSeconds());
  const put = (name: string, data: Uint8Array): void => void (entries[name] = [data, { level: ZIP_LEVEL, mtime }]);
  const materialJson = buildMaterialJson({ plan, options, projectName: input.projectName, colorMode: input.colorMode, preview: input.preview, app: input.app, now: input.now });
  put('material.json', encoder.encode(`${JSON.stringify(materialJson, null, 2)}\n`));

  let step = 0;
  for (const file of plan.files) {
    checkCancelled();
    step += 1;
    input.onProgress?.({ text: `Encoding ${file.kind === 'masks' ? 'masks' : file.kind}`, done: step, total });
    if (file.kind === 'albedo') put(file.fileName, pngBytes(await sized('albedo', toRgb)));
    else if (file.kind === 'normal') {
      const normal = await sized('normal', toRgb);
      put(file.fileName, pngBytes(normalConventionFor(options.target) === 'directx' ? flipNormalGreen(normal) : normal));
    } else if (GREY_KINDS.includes(file.kind)) put(file.fileName, pngBytes(await greyAtSize(file.kind)));
    else if (file.kind === 'orm' && plan.orm !== null) {
      const packed = packOrmPixels({
        ...(plan.orm.ao ? { ao: await greyAtSize('ao') } : {}),
        ...(plan.orm.rough ? { rough: await greyAtSize('roughness') } : {}),
        ...(plan.orm.metal ? { metal: await greyAtSize('metallic') } : {}),
      });
      if (packed !== null) put(file.fileName, pngBytes(packed));
    } else if (file.kind === 'labels' && input.masks !== null) {
      put(file.fileName, pngBytes(labelsToPaletteRgb(resampleLabelsNearest(toGrey(await load('labels')), options.size), input.masks.palette)));
    } else if (file.kind === 'masks' && input.masks !== null) put(file.fileName, encoder.encode(`${JSON.stringify(buildMasksJson(input.masks), null, 2)}\n`));
  }

  checkCancelled();
  if (input.script !== null) put(input.script.fileName, encoder.encode(input.script.text));
  input.onProgress?.({ text: 'Packing the zip', done: total, total });
  return { bytes: zipSync(entries), fileName: `${plan.name}.zip` };
}
