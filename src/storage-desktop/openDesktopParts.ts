import type { BlobStore, StorageLocation, StorageManagerLike } from '../projects';
import type { VaultStorage } from '../keys';
import { createDesktopBlobStore } from './desktopBlobStore';
import { createDesktopRecordEngine, type DesktopRecordEngine } from './DesktopRecordEngine';
import { createDesktopStorageHealth } from './desktopStorageHealth';
import { createDesktopVaultStorage } from './desktopVaultStorage';
import { createTauriDialogs, type DesktopPickers } from './tauri/tauriDialogs';
import { createTauriFileBridge } from './tauri/tauriFileBridge';
import { createLibraryClient } from './tauri/tauriLibrary';
import { createTauriRecordBridge } from './tauri/tauriRecordBridge';
import { readTauriInvoke, type TauriInvoke } from './tauri/tauriInvoke';

/** Everything an app needs from the desktop side: the record engine (each app wraps it in its own database adapter), files, the key vault, storage numbers and the library's place. */
export interface DesktopParts {
  engine: DesktopRecordEngine;
  blobs: BlobStore;
  vaultStorage: VaultStorage;
  storage: StorageManagerLike;
  location: StorageLocation;
  pickers: DesktopPickers; // the native Save and folder dialogs, in the shape of the browser's pickers (R13)
}

export interface DesktopOptions {
  invoke?: TauriInvoke; // the window's bridge by default; tests pass a fake
  reload?: () => void; // after the library changed; reloads the page by default
}

/**
 * Storage-backends R11: opens the remembered library, or on the first start uses the default folder without asking. Another folder is chosen later
 * in Settings (`location.change()`). Failures to open (folder missing, library held by another copy) are thrown as BridgeErrors for the entry to show.
 */
export async function openDesktopParts(options: DesktopOptions = {}): Promise<DesktopParts> {
  const invoke = options.invoke ?? readTauriInvoke();
  const reload = options.reload ?? (() => window.location.reload());
  const library = createLibraryClient(invoke);

  const path = (await library.open()) ?? (await library.useDefault()); // first start: the default folder, no question asked

  const files = createTauriFileBridge(invoke, 'library');
  const appFiles = createTauriFileBridge(invoke, 'appdata');
  return {
    engine: createDesktopRecordEngine(createTauriRecordBridge(invoke)),
    blobs: createDesktopBlobStore(files),
    vaultStorage: createDesktopVaultStorage(appFiles),
    storage: createDesktopStorageHealth(files),
    pickers: createTauriDialogs(invoke),
    location: {
      path,
      showInFolder: () => library.showInFolder(),
      async change() {
        const choice = await library.choose();
        if (choice.result === 'chosen') {
          reload();
          return 'changed';
        }
        return choice.result === 'refused' ? { refused: choice.message } : 'cancelled';
      },
    },
  };
}
