import {
  AdditiveBlending, DoubleSide, Group, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, MeshBasicMaterial, NormalBlending, PlaneGeometry, RingGeometry,
  ShaderMaterial, Vector2, type Object3D, type Texture,
} from 'three';
import type { AtlasGrid } from '../gpu/stampGeometry';
import { shapeCoverageGlsl, shapeFlagOf, tileRect } from '../gpu/stampGeometry';

/** One ghost stamp: the position is a picture coordinate (plane uv x tiling), the angle in radians; the same fields as a real stamp. */
export interface GhostStamp {
  shape: number;
  invert: boolean;
  x: number;
  y: number;
  size: number;
  angle: number;
}

const MAX_GHOSTS = 4096;
const RING_RADIUS = 0.012;

const VERTEX = `
attribute vec4 iPlace; // centre x, centre y (picture coordinates), size, angle
attribute vec4 iTile;
attribute float iInvert;
uniform vec2 uTiling;
uniform float uZ;
varying vec2 vLocal;
varying vec4 vTile;
varying float vInvert;
void main() {
  float c = cos(iPlace.w);
  float s = sin(iPlace.w);
  vec2 rotated = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * iPlace.z;
  vLocal = position.xy + 0.5;
  vTile = iTile;
  vInvert = iInvert;
  vec2 onPlane = (iPlace.xy + rotated) / uTiling - 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(onPlane, uZ, 1.0);
}`;

// The same shape lookup as the painter's stamps (stampShaders.ts): atlas rows run top to bottom, local y points up.
const FRAGMENT = `
uniform sampler2D uAtlas;
uniform vec3 uTint;
uniform float uOpacity;
varying vec2 vLocal;
varying vec4 vTile;
varying float vInvert;
void main() {
  float shape = texture2D(uAtlas, vTile.xy + vec2(vLocal.x, 1.0 - vLocal.y) * vTile.zw).r;
  shape = ${shapeCoverageGlsl('shape', 'vInvert')}; // vInvert is the shape flag (stampGeometry.ts)
  vec2 box = abs(vLocal * 2.0 - 1.0);
  float inside = 1.0 - step(1.0, max(box.x, box.y));
  float outline = step(0.985, max(box.x, box.y)) * inside * 0.35;
  gl_FragColor = vec4(uTint, (shape * uOpacity + outline) * inside);
}`;

export interface GhostOverlay {
  /** Shows the stamps (picture coordinates) tinted with the material colour (sRGB bytes) on the surface at height `z` of the Plane's frame. */
  show(stamps: readonly GhostStamp[], tint: readonly [number, number, number], z: number): void;
  hide(): void;
  /** The ring of the line marker (R13), or none. */
  setMarker(point: { x: number; y: number } | null, z: number): void;
  setTiling(x: number, y: number): void;
  dispose(): void;
}

/** Compositing R14, R13: translucent copies of the next stamp (or of a line's stamps) and the line marker, drawn over the Plane in its own frame. Never a map. */
export function createGhostOverlay(root: Object3D, atlas: Texture, grid: AtlasGrid, invalidate: () => void): GhostOverlay {
  const geometry = new InstancedBufferGeometry();
  const quad = new PlaneGeometry(1, 1);
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.getAttribute('position'));
  const place = new InstancedBufferAttribute(new Float32Array(MAX_GHOSTS * 4), 4);
  const tile = new InstancedBufferAttribute(new Float32Array(MAX_GHOSTS * 4), 4);
  const invert = new InstancedBufferAttribute(new Float32Array(MAX_GHOSTS), 1);
  geometry.setAttribute('iPlace', place);
  geometry.setAttribute('iTile', tile);
  geometry.setAttribute('iInvert', invert);
  geometry.instanceCount = 0;
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { uAtlas: { value: atlas }, uTint: { value: [1, 1, 1] }, uOpacity: { value: 0.55 }, uTiling: { value: new Vector2(1, 1) }, uZ: { value: 0 } },
    transparent: true, depthTest: false, depthWrite: false, blending: NormalBlending, side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false; // the instances lie anywhere on the Plane; the geometry's own bounds are the unit quad
  mesh.renderOrder = 20;
  mesh.visible = false;
  const ringMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
  const ring = new Mesh(new RingGeometry(RING_RADIUS * 0.7, RING_RADIUS, 28), ringMaterial);
  ring.renderOrder = 21;
  ring.visible = false;
  const holder = new Group();
  holder.name = 'paintGhost';
  holder.add(mesh, ring);
  root.add(holder);
  const tiling = new Vector2(1, 1);

  return {
    show(stamps, tint, z) {
      const count = Math.min(stamps.length, MAX_GHOSTS);
      for (let index = 0; index < count; index += 1) {
        const stamp = stamps[index]!;
        const rect = tileRect(grid, Math.max(stamp.shape, 0));
        place.set([stamp.x, stamp.y, stamp.size, stamp.angle], index * 4);
        tile.set([rect.u0, rect.v0, rect.du, rect.dv], index * 4);
        invert.array[index] = shapeFlagOf(stamp);
      }
      place.needsUpdate = true;
      tile.needsUpdate = true;
      invert.needsUpdate = true;
      geometry.instanceCount = count;
      material.uniforms.uTint!.value = [tint[0] / 255, tint[1] / 255, tint[2] / 255];
      material.uniforms.uZ!.value = z;
      mesh.visible = count > 0;
      invalidate();
    },
    hide() {
      if (!mesh.visible) return;
      mesh.visible = false;
      invalidate();
    },
    setMarker(point, z) {
      ring.visible = point !== null;
      if (point !== null) ring.position.set(point.x / tiling.x - 0.5, point.y / tiling.y - 0.5, z);
      invalidate();
    },
    setTiling(x, y) {
      tiling.set(x, y);
      material.uniforms.uTiling!.value = new Vector2(x, y);
    },
    dispose() {
      root.remove(holder);
      geometry.dispose();
      quad.dispose();
      material.dispose();
      ring.geometry.dispose();
      ringMaterial.dispose();
      invalidate();
    },
  };
}
