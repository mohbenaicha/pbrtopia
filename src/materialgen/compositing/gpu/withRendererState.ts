import { Color, type WebGLRenderer, type WebGLRenderTarget } from 'three';

/**
 * Compositing A4.5: run painter work on a renderer other code also uses (the preview's), and leave it as found: render target (with face and mip), auto clear,
 * clear colour and alpha, and the raw colour write mask the painter sets for the AO-safe packed texture (three has no call for it). The mask is put back to
 * "all channels", the only state anything else uses. Viewport and scissor are not touched: the painter keeps both on its own targets.
 */
export function withRendererState<T>(renderer: WebGLRenderer, work: () => T): T {
  const target: WebGLRenderTarget | null = renderer.getRenderTarget();
  const face = renderer.getActiveCubeFace();
  const level = renderer.getActiveMipmapLevel();
  const autoClear = renderer.autoClear;
  const clearColour = renderer.getClearColor(new Color());
  const clearAlpha = renderer.getClearAlpha();
  const gl = renderer.getContext() as WebGL2RenderingContext;
  try {
    return work();
  } finally {
    gl.colorMask(true, true, true, true);
    renderer.autoClear = autoClear;
    renderer.setClearColor(clearColour, clearAlpha);
    renderer.setRenderTarget(target, face, level);
  }
}
