import { StoreAbort, storeFailure, type StoreError } from '../projects';
import { BridgeError } from './bridgeError';

/** Storage-backends R9, R14: opening the library failed (folder gone, held by another copy). Rust's message names the cause in plain words and holds no path, so it is shown as it is. */
export function storeFailureFromLibraryOpen(error: unknown): { ok: false; error: StoreError } {
  if (error instanceof BridgeError) return storeFailure('storage-unavailable', error.message);
  return storeFailure('storage-unavailable', 'The library could not be opened.');
}

/** Storage-backends R9: what went wrong in a call to the desktop side, as the store error and plain words the app shows. */
export function storeFailureFromBridge(error: unknown): { ok: false; error: StoreError } {
  if (error instanceof StoreAbort) return { ok: false, error: error.storeError };
  if (error instanceof BridgeError) {
    if (error.kind === 'no-space') return storeFailure('quota-exceeded', 'There is no room left to save. Free up space or export your projects.');
    if (error.kind === 'missing-root') return storeFailure('storage-unavailable', 'The library folder cannot be found.');
    if (error.kind === 'denied' || error.kind === 'busy') return storeFailure('storage-unavailable', 'The library folder would not let the app save. Check that it is not read-only or in use by another program.');
  }
  return storeFailure('storage-unavailable', 'The app could not read or save your projects.');
}
