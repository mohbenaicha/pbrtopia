import { flipNormalGreen } from '@mat/export/pixels/exportPixels';
import { MATERIAL_SIZES, type MaterialSize } from '@mat/maps';
import { decodePng, encodePng, isIndexedImage, type DecodedPng, type PixelImage } from '@mat/maps/png/pngCodec';
import { MAX_COMPONENTS } from '@mat/masks/describe/parseComponents';
import type { MapKind } from '@mat/maps';

// Reads a Blender export (the files export/ writes) and checks it, for the sample conversion (materialgen/default-projects R3-R7, R10).

export class SampleConversionError extends Error {}

export type ExportFiles = Readonly<Record<string, Uint8Array>>;

/** A map ready to store: its file bytes and the name it came from. */
export interface ConvertedMap {
  kind: MapKind;
  bytes: Uint8Array;
  fileName: string;
  width: number;
  height: number;
}

export interface LabelEntry {
  index: number;
  hex: string; // "#rrggbb", lowercase
  name: string;
  baseMaterial: string;
  roughness: number;
  metal: number;
}

export interface BlenderExport {
  name: string;
  size: MaterialSize;
  colorMode: 'albedo' | 'diffuse';
  heightScale: number;
  heightMidlevel: number;
  tiling: { x: number; y: number };
  maps: ConvertedMap[]; // colour, normal, height, rough, metal and ao as far as the export has them
  masks: { entries: LabelEntry[]; labels: ConvertedMap } | null;
  previewPicture: Uint8Array | null; // the export's preview-*.jfif, kept as it is (R3, R8)
}

const PREVIEW_PICTURE = /^preview[^/]*\.(jfif|jpe?g)$/i;

function findPreviewPicture(files: ExportFiles): Uint8Array | null {
  const name = Object.keys(files).filter((file) => PREVIEW_PICTURE.test(file)).sort()[0];
  return name === undefined ? null : files[name]!;
}

const fail = (message: string): never => {
  throw new SampleConversionError(message);
};

type Raw = Record<string, unknown>;
const isRaw = (value: unknown): value is Raw => value !== null && typeof value === 'object' && !Array.isArray(value);
const isUnit = (value: unknown): value is number => typeof value === 'number' && value >= 0 && value <= 1;

function readJson(files: ExportFiles, name: string): Raw {
  const bytes = files[name];
  if (bytes === undefined) return fail(`${name} is missing.`);
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isRaw(parsed) ? parsed : fail(`${name} is not a JSON object.`);
  } catch (error) {
    if (error instanceof SampleConversionError) throw error;
    return fail(`${name} cannot be read as JSON.`);
  }
}

function readPicture(files: ExportFiles, fileName: string, size: MaterialSize): { bytes: Uint8Array; image: DecodedPng } {
  const bytes = files[fileName];
  if (bytes === undefined) return fail(`${fileName} is missing.`);
  let image: DecodedPng;
  try {
    image = decodePng(bytes);
  } catch {
    return fail(`${fileName} is not a readable PNG picture.`);
  }
  if (image.width !== size || image.height !== size) fail(`${fileName} is ${image.width} by ${image.height}, not the size ${size} that material.json says.`);
  return { bytes, image };
}

/** The picture kinds an export writes, and the stored map each becomes (R3). */
const FILE_KINDS = [['normal', 'normal'], ['height', 'height'], ['roughness', 'rough'], ['metallic', 'metal'], ['ao', 'ao']] as const;

function readMaps(files: ExportFiles, material: Raw, size: MaterialSize, colorKind: MapKind, directx: boolean): ConvertedMap[] {
  const named = isRaw(material['files']) ? material['files'] : {};
  const maps: ConvertedMap[] = [];
  const kinds: ReadonlyArray<readonly [string, MapKind]> = [['albedo', colorKind], ...FILE_KINDS];
  for (const [exportKind, kind] of kinds) {
    const fileName = named[exportKind];
    if (fileName === undefined) continue; // an export leaves out what the material does not have
    if (typeof fileName !== 'string') fail(`material.json: files.${exportKind} is not a file name.`);
    const { bytes, image } = readPicture(files, fileName as string, size);
    const turned = kind === 'normal' && directx && !isIndexedImage(image) ? encodePng(flipNormalGreen(image)) : bytes; // R5: the app keeps OpenGL normals
    maps.push({ kind, bytes: turned, fileName: fileName as string, width: image.width, height: image.height });
  }
  return maps;
}

const HEX = /^#?([0-9a-f]{6})$/i;

function readLabelEntries(masks: Raw): LabelEntry[] {
  const list = masks['labels'];
  if (!Array.isArray(list)) return fail('masks.json has no "labels" list.');
  const entries: LabelEntry[] = [];
  for (const item of list as unknown[]) {
    const raw = isRaw(item) ? item : {};
    const hex = typeof raw['hex'] === 'string' ? HEX.exec(raw['hex']) : null;
    const index = raw['index'];
    const valid = typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < MAX_COMPONENTS;
    if (!valid || hex === null || typeof raw['name'] !== 'string' || typeof raw['baseMaterial'] !== 'string' || !isUnit(raw['roughness']) || !isUnit(raw['metal'])) {
      return fail(`masks.json has a label that is not usable (index 0 to ${MAX_COMPONENTS - 1}, a #rrggbb colour, a name, a base material, roughness and metal from 0 to 1): ${JSON.stringify(item).slice(0, 80)}`);
    }
    const entry: LabelEntry = { index: index as number, hex: `#${hex[1]!.toLowerCase()}`, name: raw['name'], baseMaterial: raw['baseMaterial'], roughness: raw['roughness'], metal: raw['metal'] };
    if (entries.some((other) => other.index === entry.index)) fail(`masks.json uses the label index ${entry.index} twice.`);
    if (entries.some((other) => other.hex === entry.hex)) fail(`masks.json gives two labels the colour ${entry.hex}, so labels.png cannot be read.`);
    entries.push(entry);
  }
  return entries;
}

/** R6: the colour picture back to one label number per pixel, by exact match with the palette. */
function labelNumbers(image: DecodedPng, entries: readonly LabelEntry[], fileName: string): PixelImage {
  const numberOf = new Map(entries.map((entry) => [Number.parseInt(entry.hex.slice(1), 16), entry.index] as const));
  const count = image.width * image.height;
  const out = new Uint8Array(count);
  const rgbAt = (pixel: number): number => {
    if (isIndexedImage(image)) {
      const at = image.indices[pixel]! * 3;
      return (image.palette[at]! << 16) | (image.palette[at + 1]! << 8) | image.palette[at + 2]!;
    }
    if (image.channels === 1) return fail(`${fileName} is a grey picture; it must be in colour.`);
    const at = pixel * image.channels;
    return (image.data[at]! << 16) | (image.data[at + 1]! << 8) | image.data[at + 2]!;
  };
  for (let pixel = 0; pixel < count; pixel += 1) {
    const colour = rgbAt(pixel);
    const label = numberOf.get(colour);
    if (label === undefined) return fail(`${fileName} has the colour #${colour.toString(16).padStart(6, '0')} at pixel ${pixel % image.width}, ${Math.floor(pixel / image.width)}, which is in no entry of masks.json.`);
    out[pixel] = label;
  }
  return { width: image.width, height: image.height, channels: 1, data: out };
}

function readMasks(files: ExportFiles, material: Raw, size: MaterialSize): BlenderExport['masks'] {
  const labelsName = material['labels'];
  const masksName = material['masks'];
  if (labelsName === undefined && masksName === undefined) return null;
  if (typeof labelsName !== 'string' || typeof masksName !== 'string') return fail('material.json names labels and masks only one of them; an export has both or neither.');
  const entries = readLabelEntries(readJson(files, masksName));
  if (entries.length === 0) return null; // no labels: the material has no masks
  const { image } = readPicture(files, labelsName, size);
  const grey = labelNumbers(image, entries, labelsName);
  return { entries, labels: { kind: 'labels', bytes: encodePng(grey), fileName: labelsName, width: grey.width, height: grey.height } };
}

/** Reads and checks an export's files; throws a `SampleConversionError` that names the file or field at fault (R10). */
export function readBlenderExport(files: ExportFiles): BlenderExport {
  const material = readJson(files, 'material.json');
  if (material['schema'] !== 1) fail(`material.json: schema ${String(material['schema'])} is not supported (only 1).`);
  if (material['packing'] === 'packed') fail("material.json: a packed export (packing 'packed') cannot be converted; export with separate files.");
  const size = material['size'];
  if (!MATERIAL_SIZES.includes(size as MaterialSize)) fail(`material.json: size ${String(size)} is not ${MATERIAL_SIZES.join(', ')}.`);
  const colorMode = material['colorMode'];
  if (colorMode !== 'albedo' && colorMode !== 'diffuse') fail('material.json: colorMode must be "albedo" or "diffuse".');
  if (material['normalConvention'] !== 'opengl' && material['normalConvention'] !== 'directx') fail('material.json: normalConvention must be "opengl" or "directx".');
  const tiling = isRaw(material['tiling']) ? material['tiling'] : {};
  const numbers = [material['heightScale'], material['heightMidlevel'], tiling['x'], tiling['y']];
  if (typeof material['name'] !== 'string' || material['name'] === '' || numbers.some((value) => typeof value !== 'number')) fail('material.json: name, heightScale, heightMidlevel and tiling are required.');
  const colorKind: MapKind = colorMode === 'diffuse' ? 'diffuse' : 'albedo';
  return {
    name: material['name'] as string,
    size: size as MaterialSize,
    colorMode: colorMode as 'albedo' | 'diffuse',
    heightScale: numbers[0] as number,
    heightMidlevel: numbers[1] as number,
    tiling: { x: numbers[2] as number, y: numbers[3] as number },
    maps: readMaps(files, material, size as MaterialSize, colorKind, material['normalConvention'] === 'directx'),
    masks: readMasks(files, material, size as MaterialSize),
    previewPicture: findPreviewPicture(files),
  };
}
