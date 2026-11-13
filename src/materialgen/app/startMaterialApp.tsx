import { createRoot } from 'react-dom/client';
import type { StoreResult } from '@shared/projects';
import { AppBackendsProvider, BrandMark, createBrowserBackends, detectDesktop, type AppBackends } from '@shared/shell';
import { pbrtopiaLogoUrl } from '../brand';
import '@shared/ui-kit';
import { openMaterialStore, type MaterialProjectStore } from '@mat/storage';
import { APP_ID } from './appIdentity';
import { listMissingCapabilities, type CapabilityEnv } from './capabilities/detectCapabilities';
import { MissingFeaturesPage } from './capabilities/MissingFeaturesPage';
import { readBrowserCapabilityEnv } from './capabilities/readBrowserCapabilityEnv';
import { MaterialApp } from './MaterialApp';
import { decideStartup } from './routes/startup';

const MAX_RETRIES = 3;

export interface StartDeps {
  openStore?: () => Promise<StoreResult<MaterialProjectStore>>;
  backends?: AppBackends;
  capabilityEnv?: CapabilityEnv;
}

/**
 * Storage-backends R1: the one place the backend is chosen. In the desktop window (Tauri's bridge present) the desktop module is loaded by a dynamic
 * import; anywhere else the browser store and backends are used and no desktop code is fetched. A test that passes `openStore` always gets the browser path.
 */
async function openStorage(deps: StartDeps): Promise<StoreResult<{ store: MaterialProjectStore; backends: AppBackends }>> {
  if (deps.openStore === undefined && detectDesktop()) {
    const { openDesktopMaterialApp } = await import('./desktop/openDesktopMaterialApp');
    const desktop = await openDesktopMaterialApp();
    return desktop.ok ? { ok: true, value: { store: desktop.value.store, backends: deps.backends ?? desktop.value.backends } } : desktop;
  }
  const opened = await (deps.openStore ?? (() => openMaterialStore(APP_ID)))();
  return opened.ok ? { ok: true, value: { store: opened.value, backends: deps.backends ?? createBrowserBackends(APP_ID) } } : opened;
}

/**
 * Materialgen app R6a, R8, R9: checks the browser first and, when something is missing, draws only the message and starts no storage or provider work.
 * Otherwise opens the store, lands per the address and the last-open project, and draws the app. Returns a function that removes it.
 */
export async function startMaterialApp(root: HTMLElement, deps: StartDeps = {}): Promise<() => void> {
  const reactRoot = createRoot(root);
  const missing = listMissingCapabilities(deps.capabilityEnv ?? readBrowserCapabilityEnv());
  if (missing.length > 0) {
    reactRoot.render(<MissingFeaturesPage missing={missing} />);
    return () => reactRoot.unmount();
  }
  const opened = await openStorage(deps);
  if (!opened.ok) {
    reactRoot.render(<p role="alert">{opened.error.message}</p>);
    return () => reactRoot.unmount();
  }
  const { store, backends } = opened.value;
  void store.requestPersistence(); // asks the browser to keep this origin's storage; a refusal changes nothing else (R8)
  let hash = window.location.hash;
  let decision = await decideStartup(hash, store);
  for (let retries = 0; window.location.hash !== hash && retries < MAX_RETRIES; retries += 1) {
    // the address changed while the decision was being read: decide again for the one that is there now
    hash = window.location.hash;
    decision = await decideStartup(hash, store);
  }
  if (decision.replaceHash !== null) window.history.replaceState(null, '', decision.replaceHash);
  reactRoot.render(
    <AppBackendsProvider backends={backends}>
      <MaterialApp store={store} initial={decision} />
      <BrandMark src={pbrtopiaLogoUrl} />
    </AppBackendsProvider>,
  );
  return () => reactRoot.unmount();
}
