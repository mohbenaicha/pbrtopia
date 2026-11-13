import { exportEnvironments, saveZipFile, useDesktopPickers, useProjectZipExport, useProjectZipImport, zipFileName, type DownloadEnvironment, type ProjectZipExport } from '@shared/shell';
import { useCallback } from 'react';
import type { ProjectImportState, StoreResult } from '@shared/projects';
import { estimateFreeBytes } from './estimateFreeBytes';
import { DROPPED_HEIGHT_BASE_NOTE, exportMaterialZip, importMaterialZip, type MaterialExportOutcome, type MaterialExportSource, type MaterialImportTarget, type MaterialRecord } from '@mat/storage';
import { APP_ID } from '../appIdentity';

/** Materialgen app R37: writes `<project name>.zip` (file description "Material project"), through the save picker where there is one. Cancelling the picker is not a failure. */
export function downloadMaterialZip(source: MaterialExportSource, project: { id: string; name: string }, environment?: DownloadEnvironment): Promise<StoreResult<MaterialExportOutcome>> {
  return saveZipFile(zipFileName(project.name, 'zip'), 'Material project', (sink) => exportMaterialZip(source, project.id, sink, undefined, { appId: APP_ID }), { droppedHeightBase: false }, environment);
}

/** R37: what a finished export says besides "done" (null for nothing). */
export const describeMaterialExport = (outcome: MaterialExportOutcome): string | null => (outcome.droppedHeightBase ? DROPPED_HEIGHT_BASE_NOTE : null);

/**
 * Materialgen app R33, R37: Export project. The waiting save is written first, then the zip is made; a failure becomes a message.
 * `download` is replaceable for tests.
 */
export function useMaterialExport(
  source: MaterialExportSource,
  project: { id: string; name: string } | null,
  flush: () => Promise<StoreResult<void>>,
  download: typeof downloadMaterialZip = downloadMaterialZip,
): ProjectZipExport {
  const pickers = useDesktopPickers();
  const save = useCallback(async () => {
    const saved = await flush(); // a failed save would make the zip older than the screen
    if (!saved.ok) return saved;
    const target = { id: project?.id ?? '', name: project?.name ?? '' };
    const { download: environment } = exportEnvironments(pickers);
    return environment === undefined ? download(source, target) : download(source, target, environment); // the desktop's native Save dialog when there is one (storage-backends R13)
  }, [download, source, project, flush, pickers]);
  return useProjectZipExport(project === null ? null : save, describeMaterialExport);
}

/** Materialgen app R38: Import project (the list header and the Storage section) over the shared one-at-a-time import state. */
export function useMaterialImport(store: MaterialImportTarget, onImported?: (record: MaterialRecord) => void, importZip: typeof importMaterialZip = importMaterialZip): ProjectImportState {
  return useProjectZipImport((zip, onProgress) => importZip(store, zip, onProgress, { appId: APP_ID, estimateFreeBytes }), onImported);
}
