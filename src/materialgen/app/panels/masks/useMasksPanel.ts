import { useEffect, useMemo, useRef, useState } from 'react';
import type { RawRecord } from '@shared/projects';
import type { PixelImage } from '@mat/imageops';
import { heightBaseKey, isStale, readMapPixels, type MapsController, type MapsState, type MasksCommit } from '@mat/maps';
import {
  albedoToGrey,
  chooseMaterial,
  createBakeQueue,
  hasHeightOffset,
  parseMasksRecord,
  hasMix,
  resetAllRows,
  serializeMasksRecord,
  setRowMix,
  setRowValue,
  startMaskJob,
  type BaseMaterialTable,
  type BakeQueue,
  type MaskRow,
  type MasksModelControls,
  type MasksPanelProps,
  type MasksRecord,
  type RowLabels,
} from '@mat/masks';
import { planMasksWrites } from './planMasksWrites';

export interface MasksPanelPorts {
  state: MapsState;
  masksRecord: RawRecord | undefined;
  canWrite: boolean;
  controller: Pick<MapsController, 'commitMasks' | 'refuse'>;
  readBlob(key: string): Promise<Blob | null>;
  /** The base materials of the shipped file (masks R34); the panel loads them when it is first used. */
  loadTable(): Promise<BaseMaterialTable>;
  model: MasksModelControls; // the model path (masks R64-R68), bound by the project view to the generation panel's masks-only run
  onHighlight?(label: number | null): void; // masks R80: the swatch under the pointer, drawn alone in the preview
}

const UNDO_LABEL = 'Material masks';
const TABLE_PROBLEM = 'The material list could not be loaded.';
const NO_PICTURE = 'There is no stored decomposition picture. Re-run the decomposition.';

type RowUpdate = (rows: readonly MaskRow[], table: BaseMaterialTable) => MaskRow[];

/**
 * Masks R50-R54, R58, R59, R79: everything the Material Masks controls do, on top of the maps controller. A change to a row or to the feather goes through
 * the bake queue (one bake at a time, later changes merged); when the labels are not S x S the queue rebuilds them first, in the same commit (R79).
 */
export function useMasksPanel(ports: MasksPanelPorts): MasksPanelProps {
  const { state, canWrite } = ports;
  const record = useMemo(() => parseMasksRecord(ports.masksRecord), [ports.masksRecord]);
  const portsRef = useRef(ports);
  portsRef.current = ports;

  const [table, setTable] = useState<BaseMaterialTable | null>(null);
  const [tableProblem, setTableProblem] = useState<string | null>(null);
  const tableRef = useRef<BaseMaterialTable | null>(null);
  const labelsCache = useRef<{ key: string; image: PixelImage } | null>(null);

  const stored = useRef<MasksRecord | null>(record); // the record as the last commit left it
  const queueRef = useRef<BakeQueue<MasksRecord> | null>(null);
  if (queueRef.current === null || !queueRef.current.isBusy()) stored.current = record;

  const readLabels = async (key: string): Promise<PixelImage | null> => {
    if (labelsCache.current?.key === key) return labelsCache.current.image;
    const image = await readMapPixels(await portsRef.current.readBlob(key));
    if (image !== null) labelsCache.current = { key, image };
    return image;
  };

  // R96: the albedo's grey plane, made when a bake first needs it and kept for the panel's life, per albedo working copy
  const greyCache = useRef<{ key: string; image: PixelImage } | null>(null);
  const readGrey = async (key: string): Promise<PixelImage | undefined> => {
    if (greyCache.current?.key === key) return greyCache.current.image;
    const albedo = await readMapPixels(await portsRef.current.readBlob(key));
    if (albedo === null) return undefined;
    const image = albedoToGrey(albedo);
    greyCache.current = { key, image };
    return image;
  };

  useEffect(() => {
    let cancelled = false;
    ports.loadTable().then(
      (loaded) => { if (!cancelled) { tableRef.current = loaded; setTable(loaded); } },
      () => { if (!cancelled) setTableProblem(TABLE_PROBLEM); },
    );
    return () => { cancelled = true; };
    // the table is loaded once, when the panel is first used
  }, []);

  if (queueRef.current === null) {
    queueRef.current = createBakeQueue<MasksRecord>({
      read: () => stored.current as MasksRecord,
      run: async (next) => {
        const { state: current, controller, readBlob, canWrite: writable } = portsRef.current;
        const labelsMap = current.maps.labels;
        if (!writable || labelsMap === undefined) return false;
        const labels = await readLabels(labelsMap.workingKey);
        if (labels === null) return controller.refuse('The labels file cannot be read.'), false;
        const side = current.size;
        const colour = current.maps.albedo ?? current.maps.diffuse;
        const derivedFrom = labelsMap.derivedFrom ?? (colour === undefined ? undefined : ({ kind: current.maps.albedo !== undefined ? 'albedo' : 'diffuse', key: colour.workingKey } as const));
        let record = next;
        let relabel: MasksCommit['labels'];
        let bake: MasksCommit['bake'];
        let height: MasksCommit['height'];
        const heightMap = current.maps.height;
        const needsRelabel = side !== null && labels.width !== side;
        const writes = planMasksWrites(stored.current, next, needsRelabel);
        try {
          if (side !== null && labels.width !== side) {
            // R79: the labels are not S x S (S changed, or the change was undone): rebuild them at S first, then bake, in this one commit
            if (derivedFrom === undefined) return controller.refuse('The masks need an albedo map to be made again at this size.'), false;
            const picture = labelsMap.originalKey !== labelsMap.workingKey ? await readMapPixels(await readBlob(labelsMap.originalKey)) : null;
            if (picture === null) return controller.refuse(NO_PICTURE), false;
            const built = await startMaskJob('requantise', { picture, record: next, size: side });
            if (!built.ok) return controller.refuse(built.message), false;
            ({ record, bake } = { record: built.value.record, bake: built.value.bake });
            relabel = { keepOriginal: true, working: built.value.labels, derivedFrom };
            if (hasMix(record.rows) && colour !== undefined) {
              const grey = await readGrey(colour.workingKey); // R96: bake again with the grain of the albedo at the new size
              if (grey !== undefined) bake = await startMaskJob('bake', { labels: built.value.labels, record, grey });
            }
          } else if (writes.roughMetal) {
            const grey = hasMix(next.rows) && colour !== undefined ? await readGrey(colour.workingKey) : undefined; // R96: read only while a row has the mixin on
            bake = await startMaskJob('bake', { labels, record: next, ...(grey === undefined ? {} : { grey }) });
          }
          if (heightMap !== undefined && writes.height) {
            if (hasHeightOffset(record.rows)) {
              let baseKey = heightBaseKey(current)!; // R83: the working Height's tag, else the working Height itself
              let base = await readMapPixels(await readBlob(baseKey));
              if (base === null && heightMap.offsetBase !== undefined) {
                baseKey = heightMap.workingKey; // R83: the base file is gone, so the working Height is the base from now on
                base = await readMapPixels(await readBlob(baseKey));
              }
              if (base === null) return controller.refuse('The height map cannot be read.'), false;
              const used = relabel === undefined ? labels : relabel.working;
              if (base.width !== used.width || base.height !== used.height) return controller.refuse('The height map is not the size of the masks.'), false;
              height = { image: await startMaskJob('height', { labels: used, record, base }), offsetBase: baseKey };
            } else if (heightMap.offsetBase !== undefined) {
              height = { backTo: heightMap.offsetBase }; // R84: the last offset went back to 0
            }
          }
        } catch {
          return controller.refuse('Could not bake the masks. Nothing changed.'), false;
        }
        const after = portsRef.current; // the bake takes a moment: the project may have moved on (labels replaced, lock lost)
        if (!after.canWrite || after.state.maps.labels?.workingKey !== labelsMap.workingKey || after.state.maps.height?.workingKey !== heightMap?.workingKey) return false;
        const done = await after.controller.commitMasks({ ...(relabel === undefined ? {} : { labels: relabel }), ...(bake === undefined ? {} : { bake }), ...(height === undefined ? {} : { height }), label: UNDO_LABEL }, serializeMasksRecord(record));
        if (done) {
          stored.current = record;
          if (relabel !== undefined) labelsCache.current = null;
        }
        return done;
      },
    });
  }
  const queue = queueRef.current;

  /** Sends a change to the bake queue; the answer says whether it was stored. */
  const submitChange = (update: (current: MasksRecord, loaded: BaseMaterialTable) => MasksRecord): Promise<boolean> => {
    const loaded = tableRef.current;
    if (!portsRef.current.canWrite || loaded === null || stored.current === null) return Promise.resolve(false);
    return queue.submit((current) => update(current, loaded));
  };
  const changeRows = (update: RowUpdate): Promise<boolean> => submitChange((current, loaded) => ({ ...current, rows: update(current.rows, loaded) }));
  // R89: one label or several; a list is one change, so one bake and one commit
  const changeRow = (labels: RowLabels, update: (row: MaskRow, loaded: BaseMaterialTable) => MaskRow): Promise<boolean> => {
    const wanted = new Set(typeof labels === 'number' ? [labels] : labels);
    return changeRows((rows, loaded) => rows.map((row) => (wanted.has(row.label) ? update(row, loaded) : row)));
  };

  return {
    record,
    table,
    tableProblem,
    stale: state.maps.labels !== undefined && isStale(state, 'labels'),
    canWrite,
    model: ports.model,
    ...(ports.onHighlight === undefined ? {} : { onHighlight: ports.onHighlight }),
    onRowMaterial: (label, name) => changeRow(label, (row, loaded) => chooseMaterial(row, name, loaded)),
    onRowRough: (label, value) => changeRow(label, (row) => setRowValue(row, 'rough', value)),
    onRowMetal: (label, value) => changeRow(label, (row) => setRowValue(row, 'metal', value)),
    onRowHeight: (label, value) => changeRow(label, (row) => setRowValue(row, 'height', value)),
    hasHeightMap: state.maps.height !== undefined,
    onRowMix: (labels, patch) => changeRow(labels, (row) => setRowMix(row, patch)),
    hasAlbedo: (state.maps.albedo ?? state.maps.diffuse) !== undefined,
    onResetAll: () => changeRows((rows, loaded) => resetAllRows(rows, loaded)),
    onFeather: (pixels) => submitChange((current) => ({ ...current, feather: pixels })),
  };
}
