import { describe, expect, it } from 'vitest';
import { detectDesktop } from '../../../src/shell/backends/detectDesktop';

describe('detectDesktop (storage-backends R1)', () => {
  it('R1 is desktop when the Tauri bridge is present on the window', () => {
    expect(detectDesktop({ __TAURI_INTERNALS__: { invoke: () => Promise.resolve() } })).toBe(true);
  });

  it('R1 is browser mode in a plain window, with no window, and when the bridge object has no invoke', () => {
    expect(detectDesktop({})).toBe(false);
    expect(detectDesktop(undefined)).toBe(false);
    expect(detectDesktop({ __TAURI_INTERNALS__: {} })).toBe(false);
    expect(detectDesktop({ __TAURI_INTERNALS__: { invoke: 'nope' } })).toBe(false);
  });

  it('R1 reads the real window by default, which has no bridge under the test runner', () => {
    expect(detectDesktop()).toBe(false);
  });
});
