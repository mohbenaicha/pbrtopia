import type { Texture, WebGLRenderer, WebGLRenderTarget } from 'three';

// The few places the painter talks to WebGL2 directly, because three has no call for them (architecture A4.1, A6): byte uploads into a render target's storage,
// mip rebuilds on demand, and the handles raw tile copies need. Every raw call ends with `resetState()` so three's cached bindings are not stale.

const propertiesOf = (renderer: WebGLRenderer, object: object): Record<string, unknown> =>
  (renderer.properties as unknown as { get(target: object): Record<string, unknown> }).get(object);

/** The WebGL texture behind a render target's texture; the target must have been rendered to or initialised. */
export function glTextureOf(renderer: WebGLRenderer, texture: Texture): WebGLTexture {
  const handle = propertiesOf(renderer, texture)['__webglTexture'] as WebGLTexture | undefined;
  if (handle === undefined) throw new Error('The texture has no GPU storage yet');
  return handle;
}

/** The WebGL framebuffer behind a render target (A6 raw tile copies read from it); the target must have been rendered to or initialised. */
export function glFramebufferOf(renderer: WebGLRenderer, target: WebGLRenderTarget): WebGLFramebuffer {
  renderer.initRenderTarget(target);
  const handle = propertiesOf(renderer, target)['__webglFramebuffer'] as WebGLFramebuffer | undefined;
  if (handle === undefined) throw new Error('The render target has no framebuffer');
  return handle;
}

/** Compositing R20: write picture-order bytes (row 0 is the top) into a render target's storage as they are, with no colour conversion. */
export function uploadPictureBytes(renderer: WebGLRenderer, target: WebGLRenderTarget, bytes: Uint8Array, channels: 1 | 4): void {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  renderer.initRenderTarget(target);
  gl.bindTexture(gl.TEXTURE_2D, glTextureOf(renderer, target.texture));
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // picture row 0 is the top, which is the last texture row
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, target.width, target.height, channels === 1 ? gl.RED : gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  renderer.resetState();
}

/** Compositing A4.1: rebuild every mip level of a texture whose own regeneration is switched off. */
export function rebuildMipmapsOf(renderer: WebGLRenderer, texture: Texture): void {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  gl.bindTexture(gl.TEXTURE_2D, glTextureOf(renderer, texture));
  gl.generateMipmap(gl.TEXTURE_2D);
  renderer.resetState();
}

/** Compositing R22: rows of a read-back (texture order, bottom row first) turned into picture order, and back. */
export function flipRows(bytes: Uint8Array, side: number, channels: number): Uint8Array {
  const rowLength = side * channels;
  const out = new Uint8Array(bytes.length);
  for (let row = 0; row < side; row += 1) out.set(bytes.subarray(row * rowLength, (row + 1) * rowLength), (side - 1 - row) * rowLength);
  return out;
}
