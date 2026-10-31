import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, LineSegments, Mesh, PlaneGeometry, ShaderMaterial, Vector3, type Box3, type Object3D, type Scene } from 'three';
import type { CameraRig } from './cameraRig';

const FADE_START = 1; // in units of the visible extent from the orbit target
const FADE_END = 2.5;
const FLOOR_MARGIN = 1.05; // the floor reaches a little past where the fade ends

/** The power of ten at or below one tenth of the model's longest side (viewport-layout R24); 1 when there is no usable side. */
export function gridCellSize(longestSide: number): number {
  if (!Number.isFinite(longestSide) || longestSide <= 0) return 1;
  return 10 ** Math.floor(Math.log10(longestSide / 10));
}

/** How much of the world the camera sees across the screen's height at the orbit target; the same for both projections. */
export function visibleExtent(rig: Pick<CameraRig, 'active' | 'distance'>): number {
  const camera = rig.active;
  if ('isOrthographicCamera' in camera) return (camera.top - camera.bottom) / camera.zoom;
  return 2 * rig.distance() * Math.tan((camera.fov * Math.PI) / 360);
}

const FADE_FUNCTION = /* glsl */ `
  uniform vec3 uCenter;
  uniform float uFadeStart;
  uniform float uFadeEnd;
  float fadeAt(vec3 world) {
    return 1.0 - smoothstep(uFadeStart, uFadeEnd, length(world.xz - uCenter.xz));
  }
`;

const FLOOR_VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Lines by screen-space distance to the nearest cell edge; lines closer than a pixel or two together fade out instead of turning into a wash.
const FLOOR_FRAGMENT = /* glsl */ `
  uniform float uCell;
  uniform vec3 uColor;
  varying vec3 vWorld;
  ${FADE_FUNCTION}
  float lineAt(vec2 coord) {
    vec2 width = fwidth(coord);
    vec2 distanceToLine = abs(fract(coord - 0.5) - 0.5) / max(width, vec2(1e-6));
    float line = 1.0 - min(min(distanceToLine.x, distanceToLine.y), 1.0);
    return line * (1.0 - smoothstep(0.25, 0.5, max(width.x, width.y)));
  }
  void main() {
    vec2 plane = vWorld.xz;
    float alpha = max(lineAt(plane / uCell) * 0.25, lineAt(plane / (uCell * 10.0)) * 0.5) * fadeAt(vWorld);
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const AXIS_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  varying vec3 vWorld;
  varying vec3 vColor;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vColor = aColor;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const AXIS_FRAGMENT = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vColor;
  ${FADE_FUNCTION}
  void main() {
    float alpha = 0.85 * fadeAt(vWorld);
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

// The axis colours come from the same tokens as the gizmo; the literals are only for a page without the stylesheet.
function readAxisColor(token: string, fallback: string): Color {
  const value = typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return new Color(value === '' ? fallback : value);
}

export interface ViewportGrid {
  readonly object: Object3D;
  setVisible(visible: boolean): void;
  isVisible(): boolean;
  setBounds(box: Box3 | null): void; // the model's box: the grid sits at its lowest point and takes its cell size from its longest side; null for no model
  update(): void; // follows the orbit target and the visible extent; call before each draw
  drawWithoutGrid(draw: () => void): void; // for the picture of a thumbnail: the grid is never part of it
  hide(): () => void; // takes the grid out of pictures made over several calls (the atlas snapshots); the function returned puts it back as it was
  dispose(): void;
}

/** A ground grid in the XZ plane that has no edge: it follows the orbit target and fades out with distance in units of the visible extent; its two axis lines stay on the world axes (viewport-layout R24). */
export function createViewportGrid({ scene, rig }: { scene: Scene; rig: CameraRig }): ViewportGrid {
  const shared = { uCenter: { value: new Vector3() }, uFadeStart: { value: FADE_START }, uFadeEnd: { value: FADE_END } };
  const axisX = readAxisColor('--axis-x', '#e5575a');
  const axisZ = readAxisColor('--axis-z', '#5a9bf2');

  const floorGeometry = new PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const floorMaterial = new ShaderMaterial({
    vertexShader: FLOOR_VERTEX,
    fragmentShader: FLOOR_FRAGMENT,
    uniforms: { ...shared, uCell: { value: 1 }, uColor: { value: new Color('#9a968e') } },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    polygonOffset: true, // pushed back so it never fights the model's own faces or the axis lines
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.frustumCulled = false;

  const axisGeometry = (from: number[], color: Color): BufferGeometry => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(from), 3));
    geometry.setAttribute('aColor', new BufferAttribute(new Float32Array([...color.toArray(), ...color.toArray()]), 3));
    return geometry;
  };
  const axisXGeometry = axisGeometry([-1, 0, 0, 1, 0, 0], axisX);
  const axisZGeometry = axisGeometry([0, 0, -1, 0, 0, 1], axisZ);
  const axisMaterial = new ShaderMaterial({ vertexShader: AXIS_VERTEX, fragmentShader: AXIS_FRAGMENT, uniforms: shared, transparent: true, depthWrite: false });
  const axisXLine = new LineSegments(axisXGeometry, axisMaterial);
  axisXLine.name = 'axis-x';
  const axisZLine = new LineSegments(axisZGeometry, axisMaterial);
  axisZLine.name = 'axis-z';
  axisXLine.frustumCulled = false;
  axisZLine.frustumCulled = false;

  const object = new Group();
  object.name = 'viewport-grid';
  object.add(floor, axisXLine, axisZLine);
  scene.add(object);

  let shown = true;
  const update = (): void => {
    const extent = visibleExtent(rig);
    shared.uCenter.value.copy(rig.target);
    shared.uFadeStart.value = extent * FADE_START;
    shared.uFadeEnd.value = extent * FADE_END;
    object.position.x = rig.target.x;
    object.position.z = rig.target.z;
    const reach = extent * FADE_END * FLOOR_MARGIN;
    floor.scale.set(reach, 1, reach);
    // The group follows the target, but the axes are the world's: each line slides along itself and stays on x = 0 or z = 0.
    axisXLine.scale.set(reach, 1, 1);
    axisXLine.position.set(0, 0, -object.position.z);
    axisZLine.scale.set(1, 1, reach);
    axisZLine.position.set(-object.position.x, 0, 0);
  };
  update();

  const hide = (): (() => void) => {
    const before = object.visible;
    object.visible = false;
    return () => {
      object.visible = before;
    };
  };

  return {
    object,
    setVisible(visible) {
      shown = visible;
      object.visible = visible;
    },
    isVisible: () => shown,
    setBounds(box) {
      if (box === null || box.isEmpty()) {
        floorMaterial.uniforms['uCell']!.value = 1;
        object.position.y = 0;
        return;
      }
      const size = box.getSize(new Vector3());
      floorMaterial.uniforms['uCell']!.value = gridCellSize(Math.max(size.x, size.y, size.z));
      object.position.y = box.min.y;
    },
    update,
    drawWithoutGrid(draw) {
      const putBack = hide();
      try {
        draw();
      } finally {
        putBack();
      }
    },
    hide,
    dispose() {
      scene.remove(object);
      floorGeometry.dispose();
      floorMaterial.dispose();
      axisXGeometry.dispose();
      axisZGeometry.dispose();
      axisMaterial.dispose();
    },
  };
}
