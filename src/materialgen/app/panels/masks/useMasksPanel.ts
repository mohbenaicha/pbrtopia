import { useEffect, useMemo, useRef, useState } from 'react';
import type { RawRecord } from '@shared/projects';
import type { PixelImage } from '@mat/imageops';
import { isStale, readMapPixels, type MapsController, type MapsState, type MasksCommit } from '@mat/maps';
import {
  chooseMaterial,
  createBakeQueue,
  parseMasksRecord,
  resetAllRows,
  resetRow,
  serializeMasksRecord,
  setRowValue,
  startMaskJob,
  type BaseMaterialTable,
  type BakeQueue,
  type MaskRow,
  type MasksModelControls,
  type MasksPanelProps,
  type MasksRecord,
} from '@mat/masks';

export interface MasksPanelPorts {
  state: MapsState;
  masksRecord: RawRecord | undefined;
  canWrite: boolean;
  controller: Pick<MapsController, 'commitMasks' | 'refuse'>;
  readBlob(key: string): Promise<Blob | null>;
  /** The base materials of the shipped file (masks R34); the panel loads them when it is first used. */
  loadTable(): Promise<BaseMaterialTable>;
  overlay: boolean; // the mask overlay on the preview (R55): one switch shared with the viewport's Material Masks icon, session-only
  onOverlay(on: boolean): void;
  model: MasksModelControls; // the model path (masks R64-R68), bound by the project view to the generation panel's masks-only run
}

const UNDO_LABEL = 'Material masks';
const TABLE_PROBLEM = 'The material list could not be loaded.';
const NO_PICTURE = 'There is no stored decomposition picture. Re-run the decomposition.';

type RowUpdate = (rows: readonly MaskRow[], table: BaseMaterialTable) => MaskRow[];

/**
 * Masks R50-R54, R58, R59, R63, R69, R71: everything the Material Masks panel does, on top of the maps controller. A change to a row or to the
 * feather goes through the bake queue (one bake at a time, later changes merged); Re-quantise is one operation that places the labels, the
 * record and the bake in one commit.
 */
export function useMasksPanel(ports: MasksPanelPorts): MasksPanelProps {
  const { state, canWrite } = ports;
  const record = useMemo(() => parseMasksRecord(ports.masksRecord), [ports.masksRecord]);
  const portsRef = useRef(ports);
  portsRef.current = ports;

  const [table, setTable] = useState<BaseMaterialTable | null>(null);
  const [tableProblem, setTableProblem] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const buildingRef = useRef(false); // set at once, so two quick calls cannot both start a build
  const [unusedLabels, setUnusedLabels] = useState<ReadonlySet<number>>(new Set());
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

  useEffect(() => {
    let cancelled = false;
    ports.loadTable().then(
      (loaded) => { if (!cancelled) { tableRef.current = loaded; setTable(loaded); } },
      () => { if (!cancelled) setTableProblem(TABLE_PROBLEM); },
    );
    return () => { cancelled = true; };
    // the table is loaded once, when the panel is first used
  }, []);

  const labelsKey = state.maps.labels?.workingKey;
  useEffect(() => {
    let cancelled = false;
    if (labelsKey === undefined || record === null) {
      setUnusedLabels(new Set());
      return;
    }
    void readLabels(labelsKey).then((labels) => {
      if (cancelled || labels === null) return;
      const used = new Set<number>(labels.data);
      setUnusedLabels(new Set(record.rows.map((row) => row.label).filter((label) => !used.has(label))));
    });
    return () => { cancelled = true; };
  }, [labelsKey, record]);

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
          } else {
            bake = await startMaskJob('bake', { labels, record: next });
          }
        } catch {
          return controller.refuse('Could not bake the masks. Nothing changed.'), false;
        }
        const after = portsRef.current; // the bake takes a moment: the project may have moved on (labels replaced, lock lost)
        if (!after.canWrite || after.state.maps.labels?.workingKey !== labelsMap.workingKey) return false;
        const done = await after.controller.commitMasks({ ...(relabel === undefined ? {} : { labels: relabel }), ...(bake === undefined ? {} : { bake }), label: UNDO_LABEL }, serializeMasksRecord(record));
        if (done) {
          stored.current = record;
          if (relabel !== undefined) labelsCache.current = null;
        }
        return done;
      },
    });
  }
  const queue = queueRef.current;

  /** Sends a change to the bake queue; the answer says whether it was stored. A change made while Re-quantise runs is not taken. */
  const submitChange = (update: (current: MasksRecord, loaded: BaseMaterialTable) => MasksRecord): Promise<boolean> => {
    const loaded = tableRef.current;
    if (!portsRef.current.canWrite || loaded === null || stored.current === null || buildingRef.current) return Promise.resolve(false);
    return queue.submit((current) => update(current, loaded));
  };
  const changeRows = (update: RowUpdate): Promise<boolean> => submitChange((current, loaded) => ({ ...current, rows: update(current.rows, loaded) }));
  const changeRow = (label: number, update: (row: MaskRow, loaded: BaseMaterialTable) => MaskRow): Promise<boolean> =>
    changeRows((rows, loaded) => rows.map((row) => (row.label === label ? update(row, loaded) : row)));

  /** Masks R66: Re-quantise of a model source. No call: the stored decomposition picture is quantised again and the bake redone with the current rows. */
  const requantiseModel = async (): Promise<void> => {
    const { state: current, controller, readBlob, canWrite: writable } = portsRef.current;
    const kept = stored.current;
    if (!writable || buildingRef.current || kept === null) return;
    if (queue.isBusy()) return controller.refuse('Wait for the bake to finish.');
    const labelsMap = current.maps.labels;
    const albedoMap = current.maps.albedo ?? current.maps.diffuse;
    if (labelsMap === undefined || labelsMap.originalKey === labelsMap.workingKey) {
      return controller.refuse(NO_PICTURE);
    }
    if (albedoMap === undefined) return controller.refuse('Re-quantise needs an albedo map.');
    buildingRef.current = true;
    setBuilding(true);
    try {
      const picture = await readMapPixels(await readBlob(labelsMap.originalKey));
      if (picture === null) return controller.refuse('The decomposition picture cannot be read.');
      const built = await startMaskJob('requantise', { picture, record: kept, size: current.size ?? labelsMap.width });
      if (!built.ok) return controller.refuse(built.message);
      const done = await controller.commitMasks(
        { labels: { keepOriginal: true, working: built.value.labels, derivedFrom: { kind: current.maps.albedo !== undefined ? 'albedo' : 'diffuse', key: albedoMap.workingKey } }, bake: built.value.bake, label: UNDO_LABEL },
        serializeMasksRecord(built.value.record),
      );
      if (done) {
        stored.current = built.value.record;
        labelsCache.current = null;
      }
    } catch {
      controller.refuse('Could not make the labels again');
    } finally {
      buildingRef.current = false;
      setBuilding(false);
    }
  };

  return {
    record,
    table,
    tableProblem,
    stale: state.maps.labels !== undefined && isStale(state, 'labels'),
    canWrite,
    busy: building,
    unusedLabels,
    overlay: ports.overlay,
    model: ports.model,
    onRowMaterial: (label, name) => changeRow(label, (row, loaded) => chooseMaterial(row, name, loaded)),
    onRowRough: (label, value) => changeRow(label, (row) => setRowValue(row, 'rough', value)),
    onRowMetal: (label, value) => changeRow(label, (row) => setRowValue(row, 'metal', value)),
    onResetRow: (label) => changeRow(label, (row, loaded) => resetRow(row, loaded)),
    onResetAll: () => changeRows((rows, loaded) => resetAllRows(rows, loaded)),
    onFeather: (pixels) => submitChange((current) => ({ ...current, feather: pixels })),
    onOverlay: ports.onOverlay,
    onRequantise: () => void requantiseModel(),
  };
}
