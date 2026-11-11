import type { CapabilityEnv, CapabilityGl } from './detectCapabilities';

function openWebgl2(doc: Document): CapabilityGl | null {
  try {
    return doc.createElement('canvas').getContext('webgl2');
  } catch {
    return null;
  }
}

const FALLBACK_TEXTURE_SIZE = 4096; // used when no context can be opened; the start gate already refused browsers below 2048
let probedTextureSize: number | null = null;

/** Generation R26: the largest picture the graphics card holds, which limits the image sizes a card offers. Read once; the probe context is released. */
export function readMaxTextureSize(win: Window = window): number {
  if (probedTextureSize !== null) return probedTextureSize;
  const gl = openWebgl2(win.document);
  const size = gl === null ? 0 : Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));
  (gl as { getExtension(name: string): { loseContext(): void } | null } | null)?.getExtension('WEBGL_lose_context')?.loseContext();
  probedTextureSize = size > 0 ? size : FALLBACK_TEXTURE_SIZE;
  return probedTextureSize;
}

/** Reads what this browser offers (materialgen R6). The probe canvas is dropped at once. */
export function readBrowserCapabilityEnv(win: Window = window): CapabilityEnv {
  return {
    gl: openWebgl2(win.document),
    hasOpfs: typeof win.navigator.storage?.getDirectory === 'function',
    hasIndexedDb: typeof win.indexedDB === 'object' && win.indexedDB !== null,
    hasWebLocks: typeof win.navigator.locks?.request === 'function',
    hasWorkers: typeof (win as { Worker?: unknown }).Worker === 'function',
  };
}
