import { describe, expect, it } from 'vitest';
import { StoreAbort, storeFailure } from '../../src/projects';
import { BridgeError, type BridgeErrorKind } from '../../src/storage-desktop/bridgeError';
import { storeFailureFromBridge, storeFailureFromLibraryOpen } from '../../src/storage-desktop/bridgeFailure';

describe('storeFailureFromBridge (storage-backends R9)', () => {
  it.each<[BridgeErrorKind, string]>([
    ['no-space', 'quota-exceeded'],
    ['denied', 'storage-unavailable'],
    ['busy', 'storage-unavailable'],
    ['missing-root', 'storage-unavailable'],
    ['io', 'storage-unavailable'],
  ])('R9 a "%s" bridge error becomes %s with a message in plain words', (kind, code) => {
    const failure = storeFailureFromBridge(new BridgeError(kind, 'internal detail'));
    expect(failure.error.code).toBe(code);
    expect(failure.error.message).not.toContain('internal detail');
    expect(failure.error.message.length).toBeGreaterThan(10);
  });

  it('R9 a StoreAbort keeps its own error, and anything else is "storage-unavailable"', () => {
    const own = storeFailure('schema-too-new', 'Saved by a newer version.').error;
    expect(storeFailureFromBridge(new StoreAbort(own))).toEqual({ ok: false, error: own });
    expect(storeFailureFromBridge(new Error('x')).error.code).toBe('storage-unavailable');
    expect(storeFailureFromBridge('text').error.code).toBe('storage-unavailable');
  });
});

describe('storeFailureFromLibraryOpen (storage-backends R9, R11)', () => {
  it('R9 a bridge error from opening the library keeps the desktop message, anything else gets a general one', () => {
    expect(storeFailureFromLibraryOpen(new BridgeError('missing-root', 'The library folder cannot be found.')).error).toMatchObject({
      code: 'storage-unavailable',
      message: 'The library folder cannot be found.',
    });
    expect(storeFailureFromLibraryOpen(new Error('x')).error).toMatchObject({ code: 'storage-unavailable', message: 'The library could not be opened.' });
  });
});
