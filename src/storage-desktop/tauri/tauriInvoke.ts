import { BridgeError } from '../bridgeError';

export interface InvokeOptions {
  /** Text headers; the commands that take a raw body carry their other arguments here. */
  headers?: Record<string, string>;
}

/**
 * Tauri's `invoke`, as the bridges use it: a command, its arguments (a plain object, or bytes for a raw body) and options.
 * Taken from `window.__TAURI_INTERNALS__` so the page imports no Tauri package (storage-backends R1); tests pass their own.
 */
export type TauriInvoke = (command: string, args?: unknown, options?: InvokeOptions) => Promise<unknown>;

export function readTauriInvoke(): TauriInvoke {
  const internals = (globalThis as { __TAURI_INTERNALS__?: { invoke?: TauriInvoke } }).__TAURI_INTERNALS__;
  if (typeof internals?.invoke !== 'function') throw new BridgeError('io', 'The desktop app is not available in this window.');
  return internals.invoke.bind(internals);
}
