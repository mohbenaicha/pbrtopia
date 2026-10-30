import { Box3, MathUtils, OrthographicCamera, PerspectiveCamera, Sphere, Vector3 } from 'three';

export type ViewAxis = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';
export type Projection = 'perspective' | 'orthographic';

const FIELD_OF_VIEW = 40;
const FIT_MARGIN = 1.1;
const POLE_OFFSET = 1e-4; // looks along Y from just off the axis so the Y-up orbit controls stay well defined
const RESET_YAW = 0.6;
const RESET_PITCH = 0.25;
// Near plane (mode R20): a share of the orbit distance, so a close-up does not clip, kept between two shares of the model radius.
const NEAR_DISTANCE_SHARE = 0.02;
const NEAR_MIN_SHARE = 1e-4;
const NEAR_MAX_SHARE = 0.005;
const MIN_DISTANCE_SHARE = 0.001; // the closest the orbit camera may get to its target, as a share of the radius

// Direction from the target to the camera for an axis view. Top has screen-up -Z, bottom +Z, the other four +Y.
export function viewDirectionForAxis(axis: ViewAxis): Vector3 {
  const sign = axis.startsWith('+') ? 1 : -1;
  if (axis.endsWith('x')) return new Vector3(sign, 0, 0);
  if (axis.endsWith('z')) return new Vector3(0, 0, sign);
  return new Vector3(0, sign * Math.cos(POLE_OFFSET), Math.sin(POLE_OFFSET));
}

export function resetViewDirection(): Vector3 {
  return new Vector3(Math.sin(RESET_YAW) * Math.cos(RESET_PITCH), Math.sin(RESET_PITCH), Math.cos(RESET_YAW) * Math.cos(RESET_PITCH));
}

export interface CameraRig {
  readonly perspective: PerspectiveCamera; // the camera the orbit controls drive
  readonly orthographic: OrthographicCamera; // follows the perspective camera
  readonly active: PerspectiveCamera | OrthographicCamera;
  readonly projection: Projection;
  readonly target: Vector3; // shared with the orbit controls
  readonly radius: number; // of the framed bounds; 1 before any model
  setProjection(projection: Projection): boolean; // true when it changed
  setAspect(aspect: number): void;
  distance(): number; // orbit distance
  distanceLimits(): { min: number; max: number };
  homeDistance(): number; // distance that fits the framed bounds
  homeCenter(): Vector3;
  placeCamera(direction: Vector3, distance: number): void;
  syncOrthographic(): void; // call after the perspective camera moves
  frameBounds(box: Box3): void;
  resetView(): void;
}

// Two cameras that share target and orientation. Input moves the perspective camera; the orthographic one copies it and sizes its frustum to what the perspective camera sees at the orbit distance.
export function createCameraRig(initialAspect: number): CameraRig {
  const perspective = new PerspectiveCamera(FIELD_OF_VIEW, initialAspect, 0.005, 200);
  const orthographic = new OrthographicCamera(-1, 1, 1, -1, 0.005, 200);
  const target = new Vector3();
  const home = new Vector3();
  let radius = 1;
  let projection: Projection = 'perspective';

  const distance = (): number => perspective.position.distanceTo(target);

  const fitDistance = (): number => {
    const halfVertical = MathUtils.degToRad(FIELD_OF_VIEW) / 2;
    const halfHorizontal = Math.atan(Math.tan(halfVertical) * perspective.aspect);
    return (radius / Math.sin(Math.min(halfVertical, halfHorizontal))) * FIT_MARGIN;
  };

  const syncOrthographic = (): void => {
    orthographic.position.copy(perspective.position);
    orthographic.quaternion.copy(perspective.quaternion);
    const height = 2 * distance() * Math.tan(MathUtils.degToRad(FIELD_OF_VIEW) / 2);
    const width = height * perspective.aspect;
    orthographic.left = -width / 2;
    orthographic.right = width / 2;
    orthographic.top = height / 2;
    orthographic.bottom = -height / 2;
    const near = Math.min(NEAR_MAX_SHARE * radius, Math.max(NEAR_MIN_SHARE * radius, NEAR_DISTANCE_SHARE * distance()));
    if (perspective.near !== near) {
      perspective.near = near;
      perspective.updateProjectionMatrix();
    }
    orthographic.near = perspective.near;
    orthographic.far = perspective.far;
    orthographic.updateProjectionMatrix();
    orthographic.updateMatrixWorld();
  };

  const placeCamera = (direction: Vector3, orbitDistance: number): void => {
    perspective.position.copy(target).addScaledVector(direction.clone().normalize(), orbitDistance);
    perspective.lookAt(target);
    perspective.updateMatrixWorld();
    syncOrthographic();
  };

  const rig: CameraRig = {
    perspective,
    orthographic,
    get active() {
      return projection === 'perspective' ? perspective : orthographic;
    },
    get projection() {
      return projection;
    },
    target,
    get radius() {
      return radius;
    },
    setProjection(next) {
      if (next === projection) return false;
      projection = next;
      syncOrthographic();
      return true;
    },
    setAspect(aspect) {
      perspective.aspect = aspect;
      perspective.updateProjectionMatrix();
      syncOrthographic();
    },
    distance,
    distanceLimits: () => ({ min: MIN_DISTANCE_SHARE * radius, max: 100 * radius }),
    homeDistance: fitDistance,
    homeCenter: () => home.clone(),
    placeCamera,
    syncOrthographic,
    frameBounds(box) {
      if (box.isEmpty()) return;
      const sphere = box.getBoundingSphere(new Sphere());
      const direction = perspective.position.clone().sub(target);
      if (direction.lengthSq() === 0) direction.copy(resetViewDirection());
      radius = sphere.radius > 0 ? sphere.radius : 1;
      target.copy(sphere.center);
      home.copy(sphere.center);
      perspective.far = 200 * radius;
      perspective.updateProjectionMatrix(); // placeCamera below sets the near plane
      placeCamera(direction, fitDistance());
    },
    resetView() {
      target.copy(home);
      placeCamera(resetViewDirection(), fitDistance());
    },
  };
  return rig;
}
