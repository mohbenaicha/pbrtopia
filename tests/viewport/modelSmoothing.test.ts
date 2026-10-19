import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createModelSmoothing } from '../../src/viewport/modelSmoothing';

afterEach(() => {
  vi.useRealTimers();
});

// Two triangles folded 90 degrees along the x axis: the first faces +z, the second faces -y; they share two corners.
function foldedPair(indexed: boolean): { root: Group; mesh: Mesh } {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2));
  geometry.setIndex([0, 1, 2, 0, 1, 3]);
  const shown = indexed ? geometry : geometry.toNonIndexed();
  if (!indexed) shown.setAttribute('normal', new BufferAttribute(new Float32Array(18).fill(0.5), 3)); // the file's own normals
  const mesh = new Mesh(shown, new MeshStandardMaterial());
  const root = new Group();
  root.add(mesh);
  return { root, mesh };
}

const normalAt = (mesh: Mesh, corner: number): number[] => {
  const normals = mesh.geometry.getAttribute('normal');
  return [normals.getX(corner), normals.getY(corner), normals.getZ(corner)];
};
const near = (actual: number[], expected: number[]): void => expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 5));

describe('model smoothing', () => {
  it('R14 an angle below the fold keeps the faces faceted at the shared corners', () => {
    const { root, mesh } = foldedPair(true);
    createModelSmoothing().apply(root, 45);
    near(normalAt(mesh, 0), [0, 0, 1]); // corner 0 of the first triangle
    near(normalAt(mesh, 3), [0, -1, 0]); // the same position in the second triangle
  });

  it('R14 an angle above the fold averages the two faces at the shared corners', () => {
    const { root, mesh } = foldedPair(true);
    createModelSmoothing().apply(root, 120);
    const average = [0, -Math.SQRT1_2, Math.SQRT1_2];
    near(normalAt(mesh, 0), average);
    near(normalAt(mesh, 3), average);
  });

  it('R14 180 puts the model\'s own geometry back, and applying it again changes nothing', () => {
    const { root, mesh } = foldedPair(true);
    const original = mesh.geometry;
    const smoothing = createModelSmoothing();
    expect(smoothing.apply(root, 45)).toBe(true);
    expect(mesh.geometry).not.toBe(original);
    expect(smoothing.apply(root, 180)).toBe(true);
    expect(mesh.geometry).toBe(original);
    expect(smoothing.apply(root, 180)).toBe(false);
  });

  it('R14 a model that has no index keeps its own normals through smoothing and back', () => {
    const { root, mesh } = foldedPair(false);
    const original = mesh.geometry;
    const smoothing = createModelSmoothing();
    smoothing.apply(root, 45);
    smoothing.apply(root, 180);
    expect(mesh.geometry).toBe(original);
    near(normalAt(mesh, 0), [0.5, 0.5, 0.5]);
    near(normalAt(mesh, 5), [0.5, 0.5, 0.5]);
  });

  it('R14 changing the angle frees the geometry it built before and never the model\'s own', () => {
    const { root, mesh } = foldedPair(true);
    const original = mesh.geometry;
    const freeOriginal = vi.spyOn(original, 'dispose');
    const smoothing = createModelSmoothing();
    smoothing.apply(root, 45);
    const first = mesh.geometry;
    const freeFirst = vi.spyOn(first, 'dispose');
    smoothing.apply(root, 120);
    expect(freeFirst).toHaveBeenCalledTimes(1);
    smoothing.apply(root, 180);
    expect(freeOriginal).not.toHaveBeenCalled();
  });

  it('R14 triangle order and UVs are kept, so picking and face ids stay valid', () => {
    const { root, mesh } = foldedPair(true);
    const before = mesh.geometry.toNonIndexed();
    createModelSmoothing().apply(root, 45);
    expect(Array.from(mesh.geometry.getAttribute('position').array)).toEqual(Array.from(before.getAttribute('position').array));
    expect(Array.from(mesh.geometry.getAttribute('uv').array)).toEqual(Array.from(before.getAttribute('uv').array));
  });

  it('R14 a wireframe overlay mesh is left alone', () => {
    const { root, mesh } = foldedPair(true);
    const wire = new Mesh(mesh.geometry, new MeshStandardMaterial());
    wire.userData['isWireframeOverlay'] = true;
    mesh.add(wire);
    const shared = mesh.geometry;
    createModelSmoothing().apply(root, 45);
    expect(wire.geometry).toBe(shared);
  });

  it('R14 dispose puts every original back and frees what was built', () => {
    const { root, mesh } = foldedPair(true);
    const original = mesh.geometry;
    const smoothing = createModelSmoothing();
    smoothing.apply(root, 45);
    const built = mesh.geometry;
    const freeBuilt = vi.spyOn(built, 'dispose');
    smoothing.dispose(root);
    expect(mesh.geometry).toBe(original);
    expect(freeBuilt).toHaveBeenCalledTimes(1);
  });

  it('R14 requests are spaced 200 ms apart and the last angle asked for is the one built', () => {
    vi.useFakeTimers();
    const { root, mesh } = foldedPair(true);
    const smoothing = createModelSmoothing();
    const applied = vi.fn();
    smoothing.request(root, 45, applied);
    smoothing.request(root, 120, applied); // before the first ran
    vi.advanceTimersByTime(0);
    expect(applied).toHaveBeenCalledTimes(1);
    near(normalAt(mesh, 0), [0, -Math.SQRT1_2, Math.SQRT1_2]); // 120, not 45
    smoothing.request(root, 45, applied); // right after a run
    vi.advanceTimersByTime(150);
    expect(applied).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60);
    expect(applied).toHaveBeenCalledTimes(2);
    near(normalAt(mesh, 0), [0, 0, 1]);
  });

  it('R14 cancel drops a waiting request', () => {
    vi.useFakeTimers();
    const { root, mesh } = foldedPair(true);
    const original = mesh.geometry;
    const smoothing = createModelSmoothing();
    smoothing.request(root, 45, () => undefined);
    smoothing.cancel();
    vi.advanceTimersByTime(500);
    expect(mesh.geometry).toBe(original);
    expect(vi.getTimerCount()).toBe(0);
  });
});
