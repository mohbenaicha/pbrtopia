import type { WebGLRenderTarget } from 'three';
import type { GpuContext } from '../gpu/gpuContext';
import { toRgba, type PixelImage } from '../gpu/pixelFormats';
import type { RtLease } from '../gpu/rtPool';

// Imageops R46, R47: the packed preview texture, R = ao, G = rough, B = metal, A = 255, built from the three maps' red channels.

/** The one default constant for a missing map, used by the pack, the preview and export (R46). */
export const ORM_DEFAULTS = { ao: 255, rough: 128, metal: 0 } as const;

export interface OrmSources {
  ao?: PixelImage;
  rough?: PixelImage;
  metal?: PixelImage;
}

const ORM_FRAGMENT = `
uniform sampler2D uAo;
uniform sampler2D uRough;
uniform sampler2D uMetal;
uniform vec3 uHas;       // 1 when the map exists
uniform vec3 uDefaults;  // value of a missing map, 0..1
varying vec2 vUv;
void main() {
  float ao = uHas.x > 0.5 ? texture2D(uAo, vUv).r : uDefaults.x;
  float rough = uHas.y > 0.5 ? texture2D(uRough, vUv).r : uDefaults.y;
  float metal = uHas.z > 0.5 ? texture2D(uMetal, vUv).r : uDefaults.z;
  gl_FragColor = vec4(ao, rough, metal, 1.0);
}`;

/**
 * Packs the maps that exist into one RGBA8 target of the given size and returns its lease (the caller keeps it while the pack is valid and
 * releases it to dispose the pack). Null when none of the three exists: there is no packed texture then.
 */
export function buildOrmPack(ctx: GpuContext, maps: OrmSources, size: number): RtLease<WebGLRenderTarget> | null {
  if (!maps.ao && !maps.rough && !maps.metal) return null;
  const textures = [maps.ao, maps.rough, maps.metal].map((map) => (map ? ctx.upload(toRgba(map), map.width, map.height) : ctx.upload(new Uint8Array(4), 1, 1)));
  const pass = ctx.createPass(ORM_FRAGMENT, {
    uAo: { value: textures[0] },
    uRough: { value: textures[1] },
    uMetal: { value: textures[2] },
    uHas: { value: { x: maps.ao ? 1 : 0, y: maps.rough ? 1 : 0, z: maps.metal ? 1 : 0 } },
    uDefaults: { value: { x: ORM_DEFAULTS.ao / 255, y: ORM_DEFAULTS.rough / 255, z: ORM_DEFAULTS.metal / 255 } },
  });
  const lease = ctx.pool.acquire('rgba8', size, size);
  try {
    ctx.run(pass, lease.target);
    return lease;
  } catch (error) {
    lease.release();
    throw error;
  } finally {
    ctx.releasePass(pass);
    textures.forEach((texture) => texture.dispose());
  }
}
