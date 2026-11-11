import { useEffect, useMemo, useRef, useState } from 'react';
import { reportMissingFiles, useMapsController, type GpuResizer, type MapsController, type MapsHost, type MapsState } from '@mat/maps';
import type { MaterialProjectStore, MaterialRecord } from '@mat/storage';
import { estimateFreeBytes } from './estimateFreeBytes';
import type { OpenMaterial } from './useMaterialProject';

type MapsStore = Pick<MaterialProjectStore, 'readBlob' | 'writeBlob' | 'deleteBlob'>;

interface Options {
  store: MapsStore;
  projectId: string;
  record: MaterialRecord | null;
  canWrite: boolean;
  project: Pick<OpenMaterial, 'commit' | 'missingFiles' | 'whenSwept'>;
  /** Resamples whole pictures to S x S on the graphics card (maps R27). */
  resize: GpuResizer;
}

const EMPTY_MAPS: MapsState = { size: null, maps: {} };

/** Materialgen maps R29, R43: binds the maps controller to the open project's record and files. */
export function useMaterialMaps({ store, projectId, record, canWrite, project, resize }: Options): { state: MapsState; controller: MapsController; problems: string[]; dismissProblems(): void } {
  const state = useMemo<MapsState>(() => (record === null ? EMPTY_MAPS : { size: record.size, maps: record.maps }), [record?.size, record?.maps]);
  const referenceImages = record?.referenceImages;
  const projectName = record?.name ?? '';
  const colorMode = record?.colorMode ?? 'albedo';
  const { commit, missingFiles, whenSwept } = project;
  const [problems, setProblems] = useState<string[]>([]);
  const reported = useRef<string[] | null>(null);

  // Maps R30, R34: once per sweep, name the maps whose files are missing and drop the undo that cannot be read.
  useEffect(() => {
    if (record === null || missingFiles.length === 0 || reported.current === missingFiles) return;
    reported.current = missingFiles;
    const report = reportMissingFiles(state, missingFiles, colorMode);
    setProblems(report.lines);
    if (report.state === state) return;
    // maps R29, R30: the files the dropped entries named go once the record without them is stored
    void commit((current) => ({ ...current, size: report.state.size, maps: report.state.maps })).then((stored) => {
      if (stored.ok) for (const key of report.released) void store.deleteBlob(projectId, key);
    });
  }, [record, missingFiles, state, colorMode, commit, store, projectId]);

  const host = useMemo<MapsHost>(
    () => ({
      state,
      canWrite,
      projectName,
      colorMode,
      readBlob: (key) => store.readBlob(projectId, key),
      writeBlob: async (key, blob) => {
        await whenSwept(); // the opening sweep deletes files no record names, so a new file waits for it (maps R30)
        return store.writeBlob(projectId, key, blob);
      },
      deleteBlob: (key) => store.deleteBlob(projectId, key),
      commit: (next, masks) => commit((current) => ({ ...current, size: next.size, maps: next.maps, ...(masks === undefined ? {} : { masks }) })),
      otherReferencedKeys: () => new Set(referenceImages ?? []),
      estimateFreeBytes,
      newKey: () => `maps/${crypto.randomUUID()}.png`,
      resize,
    }),
    [state, canWrite, projectName, colorMode, store, projectId, commit, referenceImages, resize],
  );
  return { state, controller: useMapsController(host), problems, dismissProblems: () => setProblems([]) };
}
