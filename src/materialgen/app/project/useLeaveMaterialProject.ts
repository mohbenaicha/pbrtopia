import { useCallback } from 'react';
import { allowNextMove, forgetOpenProject, useRouteGuard } from '@shared/shell';
import type { MaterialProjectStore } from '@mat/storage';
import { listHash, settingsHash } from '../routes/router';

interface Options {
  store: Pick<MaterialProjectStore, 'saveAppSettings'>;
  flush(): Promise<unknown>;
  saveThumbnail(): Promise<unknown>; // preview R54: the project thumbnail when the project closes; never rejects
}

interface LeaveMaterialProject {
  showProjectList(): Promise<void>;
  showSettings(): Promise<void>;
}

/**
 * Materialgen app R12: leaving the project (the Projects button, Settings, Back, Forward or a typed address) writes the thumbnail (preview R54) and the waiting save first.
 * Opening the list closes the project, so it is no longer the one to reopen at start; Settings leaves it as the remembered one.
 */
export function useLeaveMaterialProject({ store, flush, saveThumbnail }: Options): LeaveMaterialProject {
  const writePending = useCallback(async (): Promise<void> => {
    await saveThumbnail();
    await flush();
  }, [saveThumbnail, flush]);
  useRouteGuard(async () => {
    await writePending();
    return true;
  });
  const showProjectList = useCallback(async (): Promise<void> => {
    await writePending();
    await forgetOpenProject(store);
    allowNextMove();
    window.location.hash = listHash();
  }, [store, writePending]);
  const showSettings = useCallback(async (): Promise<void> => {
    await writePending();
    allowNextMove();
    window.location.hash = settingsHash('keys');
  }, [writePending]);
  return { showProjectList, showSettings };
}
