import { saveZipFile, useProjectZipExport, useProjectZipImport, zipFileName, type DownloadEnvironment, type ProjectZipExport } from '@shared/shell';
import { useCallback } from 'react';
import type { ProjectImportState, StoreResult } from '@shared/projects';
import { estimateFreeBytes } from './estimateFreeBytes';
import { exportMaterialZip, importMaterialZip, type MaterialExportSource, type MaterialImportTarget, type MaterialRecord } from '@mat/storage';
import { APP_ID } from '../appIdentity';

/** Materialgen app R37: writes `<project name>.zip` (file description "Material project"), through the save picker where there is one. Cancelling the picker is not a failure. */
export function downloadMaterialZip(source: MaterialExportSource, project: { id: string; name: string }, environment?: DownloadEnvironment): Promise<StoreResult<void>> {
  return saveZipFile(zipFileName(project.name, 'zip'), 'Material project', (sink) => exportMaterialZip(source, project.id, sink, undefined, { appId: APP_ID }), undefined, environment);
}

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
  const save = useCallback(async () => {
    const saved = await flush(); // a failed save would make the zip older than the screen
    if (!saved.ok) return saved;
    return download(source, { id: project?.id ?? '', name: project?.name ?? '' });
  }, [download, source, project, flush]);
  return useProjectZipExport(project === null ? null : save, () => null);
}

/** Materialgen app R38: Import project (the list header and the Storage section) over the shared one-at-a-time import state. */
export function useMaterialImport(store: MaterialImportTarget, onImported?: (record: MaterialRecord) => void, importZip: typeof importMaterialZip = importMaterialZip): ProjectImportState {
  return useProjectZipImport((zip, onProgress) => importZip(store, zip, onProgress, { appId: APP_ID, estimateFreeBytes }), onImported);
}
