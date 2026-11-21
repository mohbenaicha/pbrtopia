import { MANIFEST_PATH, PROJECT_PATH, blobEntryPath, encodeJsonBytes, isDeflatable, streamZipEntries, type ZipFileEntry } from '@shared/projects';
import type { MapKind } from '@mat/maps';
import { DEFAULT_FEATHER, serializeMasksRecord, type MaskRow } from '@shared/materialMasks';
import { DEFAULT_PREVIEW_VALUES } from '@mat/storage/previewValues';
import { newMaterialRecord, type MapRecord, type MaterialRecord } from '@mat/storage/materialRecord';
import { THUMBNAIL_ENTRY_KEY, newMaterialManifest } from '@mat/storage/zip/materialManifest';
import { APP_ID } from '../app/appIdentity';
import { SampleConversionError, readBlenderExport, type BlenderExport, type ConvertedMap, type ExportFiles, type LabelEntry } from './readBlenderExport';

export type SampleConversion = { ok: true; zip: Uint8Array; projectName: string } | { ok: false; message: string };

interface ConversionOptions {
  projectId?: string;
  now?: () => string; // ISO 8601, for the record's times
}

const keyOf = (kind: MapKind): string => `maps/${kind}.png`;

function maskRow(entry: LabelEntry): MaskRow {
  return { label: entry.index, name: entry.name, description: '', location: '', defaultMaterial: entry.baseMaterial, top3: [], matchKind: 'generic', material: entry.baseMaterial, rough: entry.roughness, metal: entry.metal, height: 0 };
}

/** R4, R6, R7: one stored file per map; the labels map and the rough and metal maps record that they were made from the labels. */
function mapRecords(read: BlenderExport): MaterialRecord['maps'] {
  const maps: MaterialRecord['maps'] = {};
  for (const map of read.maps) {
    const record: MapRecord = { originalKey: keyOf(map.kind), workingKey: keyOf(map.kind), undoKey: null, width: map.width, height: map.height, source: { kind: 'dropped', name: map.fileName } };
    maps[map.kind] = record;
  }
  if (read.masks === null) return maps;
  const labels = read.masks.labels;
  const colour = maps[read.colorMode];
  maps.labels = { originalKey: keyOf('labels'), workingKey: keyOf('labels'), undoKey: null, width: labels.width, height: labels.height, source: { kind: 'computed' }, ...(colour && { derivedFrom: { kind: read.colorMode, key: colour.workingKey } }) };
  for (const kind of ['rough', 'metal'] as const) {
    const map = maps[kind];
    if (map) map.derivedFrom = { kind: 'labels', key: keyOf('labels') };
  }
  return maps;
}

/** R7, R8: the project record of the sample. */
function buildRecord(read: BlenderExport, projectId: string, now: string): MaterialRecord {
  const record = newMaterialRecord({ id: projectId, name: read.name, size: read.size, now });
  record.colorMode = read.colorMode;
  record.maps = mapRecords(read);
  record.preview = { ...DEFAULT_PREVIEW_VALUES, tilingX: read.tiling.x, tilingY: read.tiling.y, heightScale: read.heightScale, heightLevel: read.heightMidlevel };
  if (read.masks !== null) {
    const palette = read.masks.entries.map((entry) => ({ label: entry.index, hex: entry.hex, name: entry.name }));
    record.masks = serializeMasksRecord({ source: 'model', palette, feather: DEFAULT_FEATHER, rows: read.masks.entries.map(maskRow) });
  }
  return record;
}

async function zipBytes(entries: ZipFileEntry[]): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const sink = new WritableStream<Uint8Array>({ write: (chunk) => void chunks.push(chunk.slice()) });
  const written = await streamZipEntries(entries, sink);
  if (!written.ok) throw new SampleConversionError(written.error.message);
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/**
 * Materialgen/default-projects R1-R10: turns the files of a Blender export into a material project zip in the app's own format (app R37), which the
 * ordinary import reads unchanged. Nothing is guessed: a problem stops the conversion with a message that names the file or field.
 */
export async function convertBlenderExport(files: ExportFiles, options: ConversionOptions = {}): Promise<SampleConversion> {
  try {
    const read = readBlenderExport(files);
    const projectId = options.projectId ?? crypto.randomUUID();
    const record = buildRecord(read, projectId, (options.now ?? (() => new Date().toISOString()))());
    const pictures: ConvertedMap[] = [...read.maps, ...(read.masks === null ? [] : [read.masks.labels])];
    const blobs: ZipFileEntry[] = pictures.map((map) => ({ path: blobEntryPath(keyOf(map.kind)), size: map.bytes.byteLength, deflate: isDeflatable(keyOf(map.kind)), content: map.bytes }));
    const recordBytes = encodeJsonBytes(record);
    const thumbnail: ZipFileEntry[] = read.previewPicture === null ? [] : [{ path: blobEntryPath(THUMBNAIL_ENTRY_KEY), size: read.previewPicture.byteLength, deflate: false, content: read.previewPicture }]; // last, as the app's own export writes it
    const entries: ZipFileEntry[] = [{ path: PROJECT_PATH, size: recordBytes.byteLength, deflate: true, content: recordBytes }, ...blobs, ...thumbnail];
    const manifest = newMaterialManifest(APP_ID, projectId, record.name, entries.map((entry) => ({ path: entry.path, bytes: entry.size })));
    const zip = await zipBytes([{ path: MANIFEST_PATH, size: 0, deflate: true, content: encodeJsonBytes(manifest) }, ...entries]);
    return { ok: true, zip, projectName: record.name };
  } catch (error) {
    if (error instanceof SampleConversionError) return { ok: false, message: error.message };
    throw error;
  }
}
