import type { SharedProjectStore } from '../../projects/SharedProjectStore';
import { forgetOpenProject } from '../openProjectMemory';
import { listHash, projectHash } from '../routing/router';

type BackStore = Pick<SharedProjectStore, 'loadAppSettings' | 'loadProject' | 'saveAppSettings'>;

/**
 * Settings R2: where Back goes: the remembered open project, else the list. A project that no longer exists is forgotten; one that is only
 * unreadable is still the target, so its own view can say why (as at start, projects R5).
 */
export async function findSettingsBackHash(store: BackStore): Promise<string> {
  try {
    const remembered = (await store.loadAppSettings()).lastOpenProjectId;
    if (remembered === null) return listHash();
    const loaded = await store.loadProject(remembered);
    if (loaded.ok || loaded.error.code !== 'not-found') return projectHash(remembered);
    await forgetOpenProject(store);
    return listHash();
  } catch {
    return listHash();
  }
}
