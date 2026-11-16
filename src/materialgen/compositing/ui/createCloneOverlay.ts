import {
  AdditiveBlending, DoubleSide, Group, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, MeshBasicMaterial, NormalBlending, PlaneGeometry, RingGeometry, ShaderMaterial, Vector2,
  type Object3D, type Texture,
} from 'three';
import type { HighlightShape } from '../clone/gpu/cloneShaders';
import type { FloatingView } from '../clone/createCloneEngine';
import { wrappedCopies } from '../clone/plan/placement';

const RING_RADIUS = 0.012;
const PREVIEW_OPACITY = 0.6; // clone R16: the floating copy is shown at 60 % of fade x Strength
const GHOST_OPACITY = 0.35; // clone R3
const TINT_OPACITY = 0.35;
const MAX_COPIES = 4;
const LINE_WIDTH = 0.004; // picture units: the preview line's full width, rim included

// All three draws are in the Plane's own frame: a picture coordinate (plane uv x tiling) becomes `picture / tiling - 0.5`.
const PLANE_POSITION = 'vec4 planeAt(vec2 picture) { return projectionMatrix * modelViewMatrix * vec4(picture / uTiling - 0.5, uZ, 1.0); }';
const COMMON_UNIFORMS = 'uniform vec2 uTiling; uniform float uZ;';
// Clone R25: a fragment whose picture point lies beyond the Plane (0 to Tiling on both axes) is dropped, so no overlay hangs over the edge.
const CLIP_TO_PLANE = 'uniform vec2 uTiling; varying vec2 vPic; void clipToPlane() { if (any(lessThan(vPic, vec2(0.0))) || any(greaterThan(vPic, uTiling))) discard; }';

const makeMaterial = (parts: { vertex: string; fragment: string; uniforms: Record<string, { value: unknown }> }): ShaderMaterial => new ShaderMaterial({
  vertexShader: parts.vertex,
  fragmentShader: parts.fragment,
  uniforms: { uTiling: { value: new Vector2(1, 1) }, uZ: { value: 0 }, ...parts.uniforms },
  transparent: true, depthTest: false, depthWrite: false, blending: NormalBlending, side: DoubleSide,
});

export interface CloneOverlay {
  setTiling(x: number, y: number): void;
  /** The height above the plane at which the overlays are drawn (they follow the surface only roughly: depth test is off). */
  setLift(z: number): void;
  /** The highlight as a tint over the surface; null hides it. */
  showHighlight(mask: Texture | null): void;
  /** The translucent brush ghost at a picture point; null hides it (clone R3). */
  showBrush(point: { x: number; y: number } | null, size: number, shape: HighlightShape): void;
  /** The straight-run preview from the line marker to the pointer (clone R27); null hides it. */
  showLine(from: { x: number; y: number } | null, to: { x: number; y: number } | null): void;
  /** The floating copy, as colour x (fade x Strength x 0.6); null hides it (clone R16). */
  showFloating(view: FloatingView | null): void;
  /** The line marker's ring (clone R5); null hides it. */
  setMarker(point: { x: number; y: number } | null): void;
  dispose(): void;
}

/** Clone R3, R4, R5, R16: what Clone draws over the Plane, in the Plane's frame. Never a map; handles are the DOM's (createHandleLayer). */
export function createCloneOverlay(root: Object3D, invalidate: () => void): CloneOverlay {
  const holder = new Group();
  holder.name = 'cloneOverlay';
  root.add(holder);
  const tiling = new Vector2(1, 1);
  let lift = 0;
  const geometries: { dispose(): void }[] = [];

  const unit = new PlaneGeometry(1, 1);
  geometries.push(unit);

  // the highlight: the whole plane, tinted where the mask is set
  const tint = makeMaterial({
    vertex: `${COMMON_UNIFORMS} varying vec2 vPicture; ${PLANE_POSITION}
      void main() { vPicture = (position.xy + 0.5) * uTiling; gl_Position = planeAt(vPicture); }`,
    fragment: 'uniform sampler2D uMask; varying vec2 vPicture; void main() { gl_FragColor = vec4(0.15, 0.75, 1.0, texture2D(uMask, vPicture).r * ' + TINT_OPACITY.toFixed(2) + '); }',
    uniforms: { uMask: { value: null } },
  });
  const tintMesh = new Mesh(unit, tint);
  tintMesh.frustumCulled = false;
  tintMesh.renderOrder = 18;
  tintMesh.visible = false;

  // the brush ghost: one quad at a picture point, a disc or a square
  const brush = makeMaterial({
    vertex: `${COMMON_UNIFORMS} uniform vec2 uCentre; uniform float uSize; varying vec2 vLocal; varying vec2 vPic; ${PLANE_POSITION}
      void main() { vLocal = position.xy + 0.5; vPic = uCentre + position.xy * uSize; gl_Position = planeAt(vPic); }`,
    fragment: `${CLIP_TO_PLANE} uniform float uRound; varying vec2 vLocal;
      void main() {
        clipToPlane();
        float d = length(vLocal - 0.5);
        float inside = mix(1.0, 1.0 - step(0.5, d), uRound);
        vec2 box = abs(vLocal * 2.0 - 1.0);
        float edge = mix(step(0.97, max(box.x, box.y)), step(0.48, d) * (1.0 - step(0.5, d)), uRound);
        gl_FragColor = vec4(vec3(1.0), inside * (${GHOST_OPACITY.toFixed(2)} + edge * 0.4));
      }`,
    uniforms: { uCentre: { value: new Vector2() }, uSize: { value: 0.1 }, uRound: { value: 1 } },
  });
  const brushMesh = new Mesh(unit, brush);
  brushMesh.frustumCulled = false;
  brushMesh.renderOrder = 20;
  brushMesh.visible = false;

  // the floating copy: up to four wrapped instances of the lifted rectangle, placed, turned and scaled
  const copyGeometry = new InstancedBufferGeometry();
  copyGeometry.index = unit.index;
  copyGeometry.setAttribute('position', unit.getAttribute('position'));
  const centres = new InstancedBufferAttribute(new Float32Array(MAX_COPIES * 2), 2);
  copyGeometry.setAttribute('iCentre', centres);
  copyGeometry.instanceCount = 0;
  geometries.push(copyGeometry);
  const floating = makeMaterial({
    vertex: `${COMMON_UNIFORMS} attribute vec2 iCentre; uniform vec3 uFrame; uniform float uAngle; varying vec2 vLocal; varying vec2 vPic; ${PLANE_POSITION}
      void main() {
        vec2 offset = position.xy * uFrame.xy * uFrame.z;
        float c = cos(uAngle);
        float s = sin(uAngle);
        vLocal = position.xy + 0.5;
        vPic = iCentre + vec2(c * offset.x - s * offset.y, s * offset.x + c * offset.y);
        gl_Position = planeAt(vPic);
      }`,
    fragment: `${CLIP_TO_PLANE} uniform sampler2D uColour; uniform sampler2D uFade; uniform float uStrength; varying vec2 vLocal;
      void main() {
        clipToPlane();
        gl_FragColor = vec4(texture2D(uColour, vLocal).rgb, texture2D(uFade, vLocal).r * uStrength * ${PREVIEW_OPACITY.toFixed(2)});
        #include <colorspace_fragment>
      }`,
    uniforms: { uColour: { value: null }, uFade: { value: null }, uStrength: { value: 1 }, uFrame: { value: [1, 1, 1] }, uAngle: { value: 0 } },
  });
  const floatingMesh = new Mesh(copyGeometry, floating);
  floatingMesh.frustumCulled = false;
  floatingMesh.renderOrder = 19;
  floatingMesh.visible = false;

  // the line preview (clone R27): a thin quad from the marker to the pointer, white with a dark rim
  const line = makeMaterial({
    vertex: `${COMMON_UNIFORMS} uniform vec2 uFrom; uniform vec2 uTo; uniform float uWidth; varying vec2 vLocal; varying vec2 vPic; ${PLANE_POSITION}
      void main() {
        vec2 along = uTo - uFrom;
        vec2 across = normalize(vec2(-along.y, along.x) + vec2(1e-9, 0.0));
        vLocal = position.xy + 0.5;
        vPic = mix(uFrom, uTo, vLocal.x) + across * position.y * uWidth;
        gl_Position = planeAt(vPic);
      }`,
    fragment: `${CLIP_TO_PLANE} varying vec2 vLocal;
      void main() {
        clipToPlane();
        float rim = step(0.3, abs(vLocal.y - 0.5) * 2.0);
        gl_FragColor = vec4(vec3(1.0 - rim), 0.9);
      }`,
    uniforms: { uFrom: { value: new Vector2() }, uTo: { value: new Vector2() }, uWidth: { value: LINE_WIDTH } },
  });
  const lineMesh = new Mesh(unit, line);
  lineMesh.frustumCulled = false;
  lineMesh.renderOrder = 20;
  lineMesh.visible = false;

  const ringMaterial =new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
  const ring = new Mesh(new RingGeometry(RING_RADIUS * 0.7, RING_RADIUS, 28), ringMaterial);
  ring.renderOrder = 21;
  ring.visible = false;
  holder.add(tintMesh, floatingMesh, brushMesh, lineMesh, ring);

  const materials = [tint, brush, floating, line];
  const setZ = (): void => { for (const material of materials) material.uniforms['uZ']!.value = lift; };
  let markerPoint: { x: number; y: number } | null = null;
  const placeMarker = (): void => {
    ring.visible = markerPoint !== null;
    if (markerPoint !== null) ring.position.set(markerPoint.x / tiling.x - 0.5, markerPoint.y / tiling.y - 0.5, lift);
  };

  return {
    setTiling(x, y) {
      tiling.set(x, y);
      for (const material of materials) material.uniforms['uTiling']!.value = new Vector2(x, y);
      placeMarker();
      invalidate();
    },
    setLift(z) {
      lift = z;
      setZ();
      placeMarker();
      invalidate();
    },
    showHighlight(mask) {
      tint.uniforms['uMask']!.value = mask;
      tintMesh.visible = mask !== null;
      invalidate();
    },
    showBrush(point, size, shape) {
      brushMesh.visible = point !== null;
      if (point !== null) {
        brush.uniforms['uCentre']!.value = new Vector2(point.x, point.y);
        brush.uniforms['uSize']!.value = size;
        brush.uniforms['uRound']!.value = shape === 'round' ? 1 : 0;
      }
      invalidate();
    },
    showLine(from, to) {
      lineMesh.visible = from !== null && to !== null;
      if (from !== null && to !== null) {
        line.uniforms['uFrom']!.value = new Vector2(from.x, from.y);
        line.uniforms['uTo']!.value = new Vector2(to.x, to.y);
      }
      invalidate();
    },
    showFloating(view) {
      floatingMesh.visible = view !== null;
      if (view !== null) {
        const tile = { x: Math.floor(view.placement.cx), y: Math.floor(view.placement.cy) }; // the copies are shown in the repeat the copy is in
        const copies = wrappedCopies(view.frame, view.placement).slice(0, MAX_COPIES);
        copies.forEach((copy, index) => centres.set([copy.cx + tile.x, copy.cy + tile.y], index * 2));
        centres.needsUpdate = true;
        copyGeometry.instanceCount = copies.length;
        const { uniforms } = floating;
        uniforms['uColour']!.value = view.colour;
        uniforms['uFade']!.value = view.fade;
        uniforms['uStrength']!.value = view.strength;
        uniforms['uFrame']!.value = [view.frame.w, view.frame.h, view.placement.scale];
        uniforms['uAngle']!.value = view.placement.angle;
      }
      invalidate();
    },
    setMarker(point) {
      markerPoint = point;
      placeMarker();
      invalidate();
    },
    dispose() {
      root.remove(holder);
      for (const geometry of geometries) geometry.dispose();
      for (const material of [...materials, ringMaterial]) material.dispose();
      ring.geometry.dispose();
      invalidate();
    },
  };
}
