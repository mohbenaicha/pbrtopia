interface BridgeWindow {
  __TAURI_INTERNALS__?: { invoke?: unknown };
}

/**
 * Storage-backends R1: the page runs inside the desktop window when Tauri's bridge is on `window`. Asks nothing else and imports nothing,
 * so browser builds can call it at the entry without loading any desktop code.
 */
export function detectDesktop(page: BridgeWindow | undefined = typeof window === 'undefined' ? undefined : (window as BridgeWindow)): boolean {
  return typeof page?.__TAURI_INTERNALS__?.invoke === 'function';
}
