import type { SharedProjectStore } from '../../projects/SharedProjectStore';
import { listHash, projectHash, type Route, type Router } from './router';

export interface StartupDecision<Section extends string = string> {
  route: Route<Section>;
  /** An address to put in place of the current one, or null to leave it. */
  replaceHash: string | null;
  notice: 'project-not-found' | 'address-unknown' | null;
}

export type StartupStore = Pick<SharedProjectStore, 'loadProject' | 'loadAppSettings' | 'saveAppSettings'>;

const isGone = async (store: StartupStore, id: string): Promise<boolean> => {
  const loaded = await store.loadProject(id);
  return !loaded.ok && loaded.error.code === 'not-found'; // a project that is only unreadable is still opened, so its view can say why
};

/** Where the app lands at start (R5, R6, R15): an address that names a view wins, only the bare address uses the project that was open. */
export async function decideStartup<Section extends string>(hash: string, store: StartupStore, router: Pick<Router<Section>, 'classifyAddress' | 'parseHash'>): Promise<StartupDecision<Section>> {
  const kind = router.classifyAddress(hash);
  if (kind === 'unknown') return { route: { view: 'list' }, replaceHash: listHash(), notice: 'address-unknown' };
  const route = router.parseHash(hash);
  if (route.view === 'settings') return { route, replaceHash: null, notice: null };
  if (kind === 'list') return { route, replaceHash: null, notice: null };

  if (route.view === 'project') {
    if (!(await isGone(store, route.id))) return { route, replaceHash: null, notice: null };
    if ((await store.loadAppSettings()).lastOpenProjectId === route.id) await store.saveAppSettings({ lastOpenProjectId: null });
    return { route: { view: 'list' }, replaceHash: listHash(), notice: 'project-not-found' };
  }

  const last = (await store.loadAppSettings()).lastOpenProjectId;
  if (last !== null) {
    if (!(await isGone(store, last))) return { route: { view: 'project', id: last }, replaceHash: projectHash(last), notice: null };
    await store.saveAppSettings({ lastOpenProjectId: null });
  }
  return { route: { view: 'list' }, replaceHash: listHash(), notice: null };
}
