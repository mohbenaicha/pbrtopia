export const MIN_TEXTURE_SIZE = 2048; // the largest map size the first release offers (app R19)

/** The parts of a WebGL2 context the checks read, so they run without a GPU. */
export interface CapabilityGl {
  readonly MAX_TEXTURE_SIZE: number;
  getParameter(name: number): unknown;
  getExtension(name: string): unknown;
}

/** What the browser offers, read once at start. */
export interface CapabilityEnv {
  gl: CapabilityGl | null; // null when WebGL2 is not available
  hasOpfs: boolean;
  hasIndexedDb: boolean;
  hasWebLocks: boolean;
  hasWorkers: boolean;
}

export type CapabilityId = 'webgl2' | 'float-target' | 'texture-size' | 'opfs' | 'indexeddb' | 'web-locks' | 'web-workers';

export interface CapabilityCheck {
  id: CapabilityId;
  ok: boolean;
  /** What is missing, in plain words (shown when `ok` is false). */
  message: string;
}

function hasFloatTarget(gl: CapabilityGl): boolean {
  return gl.getExtension('EXT_color_buffer_float') !== null || gl.getExtension('EXT_color_buffer_half_float') !== null;
}

function maxTextureSize(gl: CapabilityGl): number {
  return Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));
}

/** Materialgen R6: each required browser feature as its own named check, in the order shown to the person. */
export function detectCapabilities(env: CapabilityEnv): CapabilityCheck[] {
  const { gl } = env;
  return [
    { id: 'webgl2', ok: gl !== null, message: 'This browser or graphics card does not support WebGL 2, which the preview needs.' },
    { id: 'float-target', ok: gl !== null && hasFloatTarget(gl), message: 'The graphics card cannot draw to high-precision images, which the maps need.' },
    { id: 'texture-size', ok: gl !== null && maxTextureSize(gl) >= MIN_TEXTURE_SIZE, message: `The graphics card cannot hold pictures of ${MIN_TEXTURE_SIZE} by ${MIN_TEXTURE_SIZE} pixels.` },
    { id: 'opfs', ok: env.hasOpfs, message: 'This browser cannot store project files on this device (origin private file system).' },
    { id: 'indexeddb', ok: env.hasIndexedDb, message: 'This browser does not provide IndexedDB, where project records are kept.' },
    { id: 'web-locks', ok: env.hasWebLocks, message: 'This browser does not provide Web Locks, which stop two tabs from changing one project.' },
    { id: 'web-workers', ok: env.hasWorkers, message: 'This browser does not support Web Workers, which keep the page responsive during heavy work.' },
  ];
}

export function listMissingCapabilities(env: CapabilityEnv): CapabilityCheck[] {
  return detectCapabilities(env).filter((check) => !check.ok);
}
