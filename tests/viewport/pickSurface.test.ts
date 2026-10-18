import { Group, Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera, SphereGeometry, type Camera } from 'three';
import { describe, expect, it } from 'vitest';
import { createSurfacePicker } from '../../src/viewport/pickSurface';
import { createWireframeOverlay } from '../../src/viewport/wireframeOverlay';

const canvas = { getBoundingClientRect: () => ({ left: 100, top: 50, width: 800, height: 600 }) as DOMRect };

function sphereSetup(camera: Camera = perspectiveAt(5)) {
  const root = new Group();
  const sphere = new Mesh(new SphereGeometry(1, 48, 32), new MeshBasicMaterial());
  root.add(sphere);
  root.updateMatrixWorld(true);
  let model: Group | undefined = root;
  const pick = createSurfacePicker({ canvas, camera: () => camera, model: () => model });
  return { root, sphere, pick, removeModel: () => (model = undefined) };
}

function perspectiveAt(z: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(40, 800 / 600, 0.01, 100);
  camera.position.set(0, 0, z);
  camera.updateMatrixWorld(true);
  return camera;
}

describe('surface picking', () => {
  it('R17 a click on the middle of a sphere returns the nearest point on it and the normal facing the viewer', () => {
    const { pick } = sphereSetup();
    const hit = pick(500, 350); // the middle of the canvas
    expect(hit).not.toBeNull();
    expect(hit!.point.x).toBeCloseTo(0, 1);
    expect(hit!.point.y).toBeCloseTo(0, 1);
    expect(hit!.point.z).toBeCloseTo(1, 1);
    expect(Math.abs(hit!.normal.x)).toBeLessThan(0.1); // the sphere is made of flat facets, so the normal is a little off the ideal one
    expect(hit!.normal.z).toBeGreaterThan(0.99);
    expect(hit!.normal.length()).toBeCloseTo(1);
  });

  it('R17 a click beside the sphere, or with no model shown, returns nothing', () => {
    const { pick, removeModel } = sphereSetup();
    expect(pick(105, 55)).toBeNull();
    removeModel();
    expect(pick(500, 350)).toBeNull();
  });

  it('R17 the point and normal are in world space, so a moved and scaled model gives its real surface', () => {
    const { pick, root } = sphereSetup();
    root.position.set(0, 0, -2);
    root.scale.setScalar(2);
    root.updateMatrixWorld(true);
    const hit = pick(500, 350)!;
    expect(hit.point.z).toBeCloseTo(0, 1); // front of a radius-2 sphere centred at z = -2
    expect(hit.normal.z).toBeGreaterThan(0.99);
  });

  it('R17 a click off the middle gives a normal that leans toward that side', () => {
    const { pick } = sphereSetup();
    const hit = pick(640, 350)!; // right of the middle
    expect(hit.normal.x).toBeGreaterThan(0.2);
    expect(hit.point.x).toBeGreaterThan(0.2);
  });

  it('R17 it works with the orthographic camera', () => {
    const camera = new OrthographicCamera(-4, 4, 3, -3, 0.01, 100);
    camera.position.set(0, 0, 5);
    camera.updateMatrixWorld(true);
    const { pick } = sphereSetup(camera);
    const hit = pick(500, 350)!;
    expect(hit.point.z).toBeCloseTo(1, 1);
    expect(pick(105, 55)).toBeNull();
  });

  it('R17 the wireframe overlay is never picked', () => {
    const { pick, root, sphere } = sphereSetup();
    const overlay = createWireframeOverlay(root);
    overlay.setVisible(true);
    root.updateMatrixWorld(true);
    expect(pick(500, 350)!.point.z).toBeCloseTo(1, 1);
    expect(sphere.children.length).toBeGreaterThan(0);
  });

  it('R17 picking the same model again gives the same answer (the search structure is built once and reused)', () => {
    const { pick, sphere } = sphereSetup();
    const first = pick(500, 350)!;
    const again = pick(500, 350)!;
    expect(again.point.toArray()).toEqual(first.point.toArray());
    expect((sphere.geometry as unknown as { boundsTree?: object }).boundsTree).toBeDefined();
  });
});
