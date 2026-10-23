import { useCallback, useEffect, useState } from 'react';
import type { ProjectStore } from '../ProjectStore';
import type { ProjectSummary } from '../records/projectRecords';

export type ListViewStore = Pick<ProjectStore, 'listProjects' | 'renameProject' | 'deleteProjects' | 'loadThumbnail'>;

type ListLoad ={ state: 'loading' } | { state: 'failed'; message: string } | { state: 'ready'; projects: ProjectSummary[] };

/** The stored projects, newest first: read on mount and after each change, with rename and delete that return an error message or null. */
export function useProjectList(store: ListViewStore) {
  const [load, setLoad] = useState<ListLoad>({ state: 'loading' });

  const reload = useCallback(async (): Promise<void> => {
    const listed = await store.listProjects();
    setLoad(listed.ok ? { state: 'ready', projects: listed.value } : { state: 'failed', message: listed.error.message });
  }, [store]);

  useEffect(() => {
    setLoad({ state: 'loading' });
    void reload();
  }, [reload]);

  const rename = useCallback(
    async (id: string, name: string): Promise<string | null> => {
      const renamed = await store.renameProject(id, name);
      if (!renamed.ok) return renamed.error.message;
      await reload();
      return null;
    },
    [store, reload],
  );

  const remove = useCallback(
    async (ids: string[], onProgress: (done: number, total: number) => void): Promise<string | null> => {
      const deleted = await store.deleteProjects(ids, onProgress);
      await reload();
      return deleted.ok ? null : deleted.error.message;
    },
    [store, reload],
  );

  return { load, reload, rename, remove };
}
