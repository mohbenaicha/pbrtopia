import { readVaultRecord, type VaultRecord, type VaultStorage } from '../keys';
import type { FileBridge } from './FileBridge';

const VAULT_FILE = 'vault.json';
const WIRE_VERSION = 1;
const UNREADABLE = 'The key vault could not be read.';
const FAILED = 'The key vault could not be saved.';

const toBase64 = (bytes: Uint8Array): string => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
};

/** The bytes of a base64 text, or the value untouched when it is not base64 (so the record check refuses it). */
function fromBase64(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  } catch {
    return value;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The wire record with each byte field turned back into bytes; anything else is left for `readVaultRecord` to refuse. */
function withBytes(wire: unknown): unknown {
  if (!isObject(wire)) return wire;
  const decodeSealed = (sealed: unknown): unknown => (isObject(sealed) ? { ...sealed, iv: fromBase64(sealed['iv']), ciphertext: fromBase64(sealed['ciphertext']) } : sealed);
  const keys = isObject(wire['keys']) ? Object.fromEntries(Object.entries(wire['keys']).map(([provider, sealed]) => [provider, decodeSealed(sealed)])) : wire['keys'];
  const kdf = isObject(wire['kdf']) ? { ...wire['kdf'], salt: fromBase64(wire['kdf']['salt']) } : wire['kdf'];
  return { ...wire, kdf, verifier: decodeSealed(wire['verifier']), keys };
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((value, i) => value === b[i]);

async function readWholeFile(files: FileBridge): Promise<Uint8Array | null> {
  const chunks = await files.read(VAULT_FILE);
  if (chunks === null) return null;
  const parts: Uint8Array[] = [];
  for await (const chunk of chunks) parts.push(chunk);
  return Uint8Array.from(parts.flatMap((part) => [...part]));
}

/** Reads what is stored: `absent` when there is no file, `unreadable` when there is one that is not a whole version-1 vault, else the record. */
async function readStored(files: FileBridge): Promise<'absent' | 'unreadable' | VaultRecord> {
  const bytes = await readWholeFile(files);
  if (bytes === null) return 'absent';
  try {
    const wire: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!isObject(wire) || wire['version'] !== WIRE_VERSION) return 'unreadable';
    return readVaultRecord(withBytes(wire['record'])) ?? 'unreadable';
  } catch {
    return 'unreadable';
  }
}

/**
 * Storage-backends R4, R5: the key vault as `vault.json` in the app's data folder (`files` is rooted there), every byte field as base64.
 * Saves are compare-and-write; the app has one window, so one queue in the page is the lock. Failures are rejected with fixed words.
 */
export function createDesktopVaultStorage(files: FileBridge): VaultStorage {
  let queue: Promise<unknown> = Promise.resolve();
  const exclusively = <T>(work: () => Promise<T>): Promise<T> => {
    const run = queue.then(work, work);
    queue = run.catch(() => undefined);
    return run;
  };

  return {
    async load() {
      let stored: Awaited<ReturnType<typeof readStored>>;
      try {
        stored = await readStored(files);
      } catch {
        throw new Error(UNREADABLE);
      }
      if (stored === 'absent') return null;
      if (stored === 'unreadable') throw new Error(UNREADABLE);
      return stored;
    },

    save: (record, basedOnRevision) =>
      exclusively(async () => {
        try {
          const current = await readStored(files);
          const stale =
            basedOnRevision === null
              ? current !== 'absent' // "no vault yet" is only true when nothing at all is stored
              : typeof current === 'string' || current.revision !== basedOnRevision || !sameBytes(current.kdf.salt, record.kdf.salt);
          if (stale) return 'conflict' as const;
          const whole = readVaultRecord(record);
          if (whole === null) throw new Error(FAILED);
          const wire = JSON.stringify({ version: WIRE_VERSION, record: whole }, (_key, value: unknown) => (value instanceof Uint8Array ? toBase64(value) : value));
          const writer = await files.write(VAULT_FILE);
          try {
            await writer.chunk(new TextEncoder().encode(wire));
            await writer.commit();
          } catch (error) {
            await writer.abort().catch(() => undefined);
            throw error;
          }
          return 'saved' as const;
        } catch {
          throw new Error(FAILED);
        }
      }),

    clear: () =>
      exclusively(async () => {
        try {
          await files.remove(VAULT_FILE, false);
        } catch {
          throw new Error(FAILED);
        }
      }),
  };
}
