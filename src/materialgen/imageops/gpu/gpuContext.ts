import {
  Color, DataTexture, HalfFloatType, LinearFilter, Mesh, NearestFilter, NoBlending, NoColorSpace, OrthographicCamera, PlaneGeometry, RGBAFormat,
  RedFormat, RepeatWrapping, Scene, ShaderMaterial, SRGBColorSpace, UnsignedByteType, WebGLRenderTarget, type IUniform, type Texture, type WebGLRenderer,
} from 'three';
import { createRtPool, type RtFormat, type RtPool } from './rtPool';

// Imageops R1-R8: the one renderer's fullscreen-pass runner, its render-target pool and the upload and readback of RGBA bytes.
// Image rows keep the order of the pixel array: row 0 is v = 0 on upload and on readback, so no pass flips anything.

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export interface UploadOptions {
  /** Albedo: the sampler decodes sRGB to linear (R4). Every other map, and exact copies, are sampled raw. */
  decodeSrgb?: boolean;
  /** Exact copies (mirror, swap) sample the texel and nothing else. */
  nearest?: boolean;
}

export interface GpuContext {
  readonly pool: RtPool<WebGLRenderTarget>;
  upload(rgba: Uint8Array, width: number, height: number, options?: UploadOptions): Texture;
  createPass(fragmentShader: string, uniforms: Record<string, IUniform>): ShaderMaterial;
  releasePass(pass: ShaderMaterial): void;
  run(pass: ShaderMaterial, target: WebGLRenderTarget): void;
  read(target: WebGLRenderTarget): Promise<Uint8Array>;
  /** Largest texture side the graphics card accepts. */
  maxTextureSize(): number;
  dispose(): void;
}

function makeTarget(format: RtFormat, width: number, height: number): WebGLRenderTarget {
  const target = new WebGLRenderTarget(width, height, {
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    format: format === 'r8' ? RedFormat : RGBAFormat,
    type: format === 'rgba16f' ? HalfFloatType : UnsignedByteType,
  });
  target.texture.colorSpace = NoColorSpace;
  return target;
}

export function createGpuContext(renderer: WebGLRenderer): GpuContext {
  const geometry = new PlaneGeometry(2, 2);
  const quad = new Mesh(geometry);
  quad.frustumCulled = false;
  const scene = new Scene();
  scene.add(quad);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pool = createRtPool(makeTarget);
  const passes = new Set<ShaderMaterial>();

  return {
    pool,
    upload(rgba, width, height, options = {}) {
      const texture = new DataTexture(rgba as Uint8Array<ArrayBuffer>, width, height, RGBAFormat, UnsignedByteType);
      texture.colorSpace = options.decodeSrgb ? SRGBColorSpace : NoColorSpace;
      const filter = options.nearest ? NearestFilter : LinearFilter;
      texture.minFilter = filter;
      texture.magFilter = filter;
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      return texture;
    },
    createPass(fragmentShader, uniforms) {
      const pass = new ShaderMaterial({ vertexShader: VERTEX_SHADER, fragmentShader, uniforms, depthTest: false, depthWrite: false, blending: NoBlending });
      passes.add(pass);
      return pass;
    },
    releasePass(pass) {
      passes.delete(pass);
      pass.dispose();
    },
    run(pass, target) {
      const previousTarget = renderer.getRenderTarget();
      const previousColor = renderer.getClearColor(new Color());
      const previousAlpha = renderer.getClearAlpha();
      quad.material = pass;
      try {
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
      } finally {
        renderer.setRenderTarget(previousTarget);
        renderer.setClearColor(previousColor, previousAlpha);
      }
    },
    async read(target) {
      const pixels = new Uint8Array(new ArrayBuffer(target.width * target.height * 4));
      await renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height, pixels);
      return pixels;
    },
    maxTextureSize: () => renderer.capabilities.maxTextureSize,
    dispose() {
      pool.dispose();
      for (const pass of passes) pass.dispose();
      passes.clear();
      geometry.dispose();
    },
  };
}
