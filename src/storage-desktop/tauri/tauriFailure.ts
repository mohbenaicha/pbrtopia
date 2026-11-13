import { BridgeError, type BridgeErrorKind } from '../bridgeError';

const KINDS: readonly string[] = ['no-space', 'denied', 'missing-root', 'busy', 'io'];

/**
 * Storage-backends R9: a rejected command is `{ kind, message }` (Rust's wire error, with a message that never holds a path).
 * Anything else — a string, an unknown kind, a thrown Error — becomes `io` with a fixed message, so raw text never reaches the page's screens.
 */
export function toBridgeError(raw: unknown): BridgeError {
  if (raw instanceof BridgeError) return raw;
  if (typeof raw === 'object' && raw !== null) {
    const { kind, message } = raw as { kind?: unknown; message?: unknown };
    if (typeof kind === 'string' && KINDS.includes(kind) && typeof message === 'string') return new BridgeError(kind as BridgeErrorKind, message);
  }
  return new BridgeError('io', 'The desktop app could not finish that.');
}

/** `invoke` with every failure turned into a BridgeError. */
export async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toBridgeError(error);
  }
}
