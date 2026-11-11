import { describe, expect, it } from 'vitest';
import { MIN_TEXTURE_SIZE, detectCapabilities, listMissingCapabilities, type CapabilityEnv } from '@mat/app/capabilities/detectCapabilities';

const FULL_GL = {
  MAX_TEXTURE_SIZE: 3379,
  getParameter: (name: number): number => (name === 3379 ? 8192 : 0),
  getExtension: (name: string): object | null => (name === 'EXT_color_buffer_float' ? {} : null),
};

const full = (overrides: Partial<CapabilityEnv> = {}): CapabilityEnv => ({ gl: FULL_GL, hasOpfs: true, hasIndexedDb: true, hasWebLocks: true, hasWorkers: true, ...overrides });

describe('materialgen/app R6 capability checks', () => {
  it('R6 passes when every feature is there', () => {
    expect(listMissingCapabilities(full())).toEqual([]);
  });

  it('R6 each check is named on its own and reports ok or missing', () => {
    const results = detectCapabilities(full());
    expect(results.map((check) => check.id)).toEqual(['webgl2', 'float-target', 'texture-size', 'opfs', 'indexeddb', 'web-locks', 'web-workers']);
    expect(results.every((check) => check.ok)).toBe(true);
  });

  it('R6 a half-float colour buffer is enough', () => {
    const gl = { ...FULL_GL, getExtension: (name: string): object | null => (name === 'EXT_color_buffer_half_float' ? {} : null) };
    expect(listMissingCapabilities(full({ gl }))).toEqual([]);
  });

  it('R6 no float or half-float colour buffer is reported as the float-target check', () => {
    const gl = { ...FULL_GL, getExtension: () => null };
    expect(listMissingCapabilities(full({ gl })).map((check) => check.id)).toEqual(['float-target']);
  });

  it('R6 a texture size below the minimum is reported, the minimum itself passes', () => {
    const small = { ...FULL_GL, getParameter: () => MIN_TEXTURE_SIZE - 1 };
    const exact = { ...FULL_GL, getParameter: () => MIN_TEXTURE_SIZE };
    expect(MIN_TEXTURE_SIZE).toBe(2048);
    expect(listMissingCapabilities(full({ gl: small })).map((check) => check.id)).toEqual(['texture-size']);
    expect(listMissingCapabilities(full({ gl: exact }))).toEqual([]);
  });

  it('R6 without WebGL2 the three GPU checks all fail', () => {
    expect(listMissingCapabilities(full({ gl: null })).map((check) => check.id)).toEqual(['webgl2', 'float-target', 'texture-size']);
  });

  it('R6 storage and worker features are checked one by one', () => {
    const missing = listMissingCapabilities(full({ hasOpfs: false, hasIndexedDb: false, hasWebLocks: false, hasWorkers: false }));
    expect(missing.map((check) => check.id)).toEqual(['opfs', 'indexeddb', 'web-locks', 'web-workers']);
  });

  it('R6a each missing feature has a plain-words line', () => {
    for (const check of listMissingCapabilities(full({ gl: null, hasOpfs: false, hasIndexedDb: false, hasWebLocks: false, hasWorkers: false }))) {
      expect(check.message.length).toBeGreaterThan(20);
      expect(check.message).not.toMatch(/OPFS|EXT_|navigator/); // no jargon in the line shown to a person
    }
  });
});
