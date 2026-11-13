import { describe, expect, it } from 'vitest';
import { BridgeError } from '../../../src/storage-desktop/bridgeError';
import { toBridgeError } from '../../../src/storage-desktop/tauri/tauriFailure';

describe('tauri command failures (storage-backends R9)', () => {
  it('R9 a failure from Rust keeps its kind and message', () => {
    for (const kind of ['no-space', 'denied', 'missing-root', 'busy', 'io'] as const) {
      const error = toBridgeError({ kind, message: 'It broke.' });
      expect(error).toBeInstanceOf(BridgeError);
      expect(error.kind).toBe(kind);
      expect(error.message).toBe('It broke.');
    }
  });

  it('R9 anything that is not a known failure shape becomes io with a plain message and no raw text', () => {
    for (const odd of [undefined, null, 'C:\\Users\\Moham\\secret failed', 42, { kind: 'weird', message: 'x' }, { kind: 'io' }, new Error('boom')]) {
      const error = toBridgeError(odd);
      expect(error.kind).toBe('io');
      expect(error.message).not.toContain('secret');
    }
  });

  it('R9 a BridgeError passes through unchanged', () => {
    const original = new BridgeError('busy', 'In use.');
    expect(toBridgeError(original)).toBe(original);
  });
});
