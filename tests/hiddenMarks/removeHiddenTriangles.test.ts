import { BoxGeometry, BufferAttribute, BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { removeHiddenTriangles } from '../../src/hiddenMarks';

describe('R30 removing hidden triangles from a geometry', () => {
  it('R30 drops the hidden triangles and the vertices only they used, keeping every attribute in step', () => {
    const box = new BoxGeometry(1, 1, 1); // 12 triangles, 24 vertices, 4 per face
    const hidden = new Uint8Array(12);
    hidden[0] = 1;
    hidden[1] = 1; // the +X face
    const result = removeHiddenTriangles(box, hidden);
    expect(result.index!.count / 3).toBe(10);
    expect(result.getAttribute('position').count).toBe(20);
    expect(result.getAttribute('uv').count).toBe(20);
    expect(result.getAttribute('normal').count).toBe(20);
    const positions = result.getAttribute('position');
    for (let v = 0; v < positions.count; v += 1) expect(positions.getX(v)).toBeLessThan(0.5 + 1e-6);
    let onPlusX = 0;
    for (let v = 0; v < positions.count; v += 1) if (Math.abs(positions.getX(v) - 0.5) < 1e-6 && Math.abs(result.getAttribute('normal').getX(v) - 1) < 1e-6) onPlusX += 1;
    expect(onPlusX).toBe(0);
  });

  it('R30 leaves the geometry it was given alone', () => {
    const box = new BoxGeometry(1, 1, 1);
    const before = box.getAttribute('position').array.length;
    removeHiddenTriangles(box, Uint8Array.from({ length: 12 }, (_, i) => (i < 2 ? 1 : 0)));
    expect(box.getAttribute('position').array.length).toBe(before);
    expect(box.index!.count).toBe(36);
  });

  it('R30 works on a non-indexed geometry and returns an indexed one', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 5, 5, 6, 5, 5, 5, 6, 5]), 3));
    const result = removeHiddenTriangles(geometry, Uint8Array.from([1, 0]));
    expect(result.index!.count).toBe(3);
    expect(result.getAttribute('position').count).toBe(3);
    expect(result.getAttribute('position').getX(0)).toBe(5);
  });

  it('R30 an empty result has an empty index', () => {
    const result = removeHiddenTriangles(new BoxGeometry(), new Uint8Array(12).fill(1));
    expect(result.index!.count).toBe(0);
    expect(result.getAttribute('position').count).toBe(0);
  });
});
