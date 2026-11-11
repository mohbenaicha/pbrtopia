import { Box3, type BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { buildMaterialBallGeometry } from '../../../../src/materialgen/preview/meshes/buildMaterialBallGeometry';
import { buildPreviewGeometry } from '../../../../src/materialgen/preview/meshes/buildPreviewGeometry';

const boxOf = (geometry: BufferGeometry): Box3 => new Box3().setFromBufferAttribute(geometry.getAttribute('position') as never);
const uvRange = (geometry: BufferGeometry) => {
  const uv = geometry.getAttribute('uv');
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < uv.array.length; i += 1) {
    min = Math.min(min, uv.array[i]!);
    max = Math.max(max, uv.array[i]!);
  }
  return { min, max };
};

/** Vertex indices grouped by position (to 0.0005): the vertices that sit at one point of the model. */
function groupByPosition(geometry: BufferGeometry): Map<string, number[]> {
  const position = geometry.getAttribute('position');
  const groups = new Map<string, number[]>();
  for (let i = 0; i < position.count; i += 1) {
    const key = [position.getX(i), position.getY(i), position.getZ(i)].map((value) => Math.round(value * 2000)).join(',');
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  return groups;
}

describe('materialgen/preview R2 R3 ball and plane', () => {
  it('R2 the ball is a sphere of radius 0.5', () => {
    const position = buildPreviewGeometry('ball', 1).getAttribute('position');
    for (let i = 0; i < position.count; i += 1) expect(Math.hypot(position.getX(i), position.getY(i), position.getZ(i))).toBeCloseTo(0.5, 5);
  });

  it('R2 R3 the plane is a square of side 1 facing +z, whatever the material size', () => {
    const box = boxOf(buildPreviewGeometry('plane', 1));
    expect(box.max.x - box.min.x).toBeCloseTo(1, 9);
    expect(box.max.y - box.min.y).toBeCloseTo(1, 9);
    expect(box.max.z - box.min.z).toBeCloseTo(0, 9);
  });

  it('R39 ball and plane are subdivided by the resolution level', () => {
    const plane = buildPreviewGeometry('plane', 1);
    expect(plane.getAttribute('position').count).toBe(129 * 129);
    const ball = buildPreviewGeometry('ball', 1);
    expect(ball.getAttribute('position').count).toBeGreaterThanOrEqual(128 * 64);
  });

  it('R39 the material ball is a fixed model: every resolution level gives the same mesh', () => {
    const fixed = buildMaterialBallGeometry().getAttribute('position').count;
    expect(fixed).toBeGreaterThan(30000);
    expect(fixed).toBeLessThan(50000);
    expect(buildPreviewGeometry('materialBall', 1).getAttribute('position').count).toBe(fixed);
    expect(buildPreviewGeometry('materialBall', 3).getAttribute('position').count).toBe(fixed);
  });

  it('R57 the ball and plane have UVs inside 0 to 1', () => {
    for (const mesh of ['ball', 'plane'] as const) {
      const { min, max } = uvRange(buildPreviewGeometry(mesh, 1));
      expect(min).toBeGreaterThanOrEqual(0);
      expect(max).toBeLessThanOrEqual(1);
    }
  });
});

describe('materialgen/preview R57 material ball', () => {
  const geometry = buildMaterialBallGeometry();

  it('R57 is one merged geometry with positions, normals and a placeholder UV inside 0 to 1', () => {
    expect(geometry.index).not.toBeNull();
    for (const name of ['position', 'normal', 'uv']) expect(geometry.getAttribute(name)).toBeDefined();
    const { min, max } = uvRange(geometry);
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(1);
  });

  it('R57 no hard edge: vertices at one position share one normal, so displacement never tears the mesh', () => {
    const normal = geometry.getAttribute('normal');
    const groups = groupByPosition(geometry);
    expect(groups.size).toBeGreaterThan(10000);
    let shared = 0;
    for (const members of groups.values()) {
      if (members.length > 1) shared += 1;
      for (const vertex of members) {
        expect(normal.getX(vertex)).toBeCloseTo(normal.getX(members[0]!), 3);
        expect(normal.getY(vertex)).toBeCloseTo(normal.getY(members[0]!), 3);
        expect(normal.getZ(vertex)).toBeCloseTo(normal.getZ(members[0]!), 3);
      }
    }
    expect(shared).toBeGreaterThan(100); // the turn about the axis closes on itself, and the poles are many vertices at one point
  });

  it('R57 the normal turns smoothly along the surface: no triangle has corners whose normals differ by more than 30 degrees', () => {
    const normal = geometry.getAttribute('normal');
    const index = geometry.index!;
    let worst = 1;
    for (let t = 0; t < index.count; t += 3) {
      for (let e = 0; e < 3; e += 1) {
        const [a, b] = [index.getX(t + e), index.getX(t + ((e + 1) % 3))];
        const dot = normal.getX(a) * normal.getX(b) + normal.getY(a) * normal.getY(b) + normal.getZ(a) * normal.getZ(b);
        worst = Math.min(worst, dot);
      }
    }
    expect(worst).toBeGreaterThan(Math.cos((30 * Math.PI) / 180));
  });

  it('R57 the mesh is fine enough for displacement: no triangle edge is longer than 0.035', () => {
    const position = geometry.getAttribute('position');
    const index = geometry.index!;
    let longest = 0;
    for (let t = 0; t < index.count; t += 3) {
      for (let e = 0; e < 3; e += 1) {
        const [a, b] = [index.getX(t + e), index.getX(t + ((e + 1) % 3))];
        longest = Math.max(longest, Math.hypot(position.getX(a) - position.getX(b), position.getY(a) - position.getY(b), position.getZ(a) - position.getZ(b)));
      }
    }
    expect(longest).toBeLessThanOrEqual(0.035);
  });

  it('R57 each surface is closed: welded by position, every edge has two triangles', () => {
    const position = geometry.getAttribute('position');
    const index = geometry.index!;
    const weld = new Map<string, number>();
    const id = (i: number): number => {
      const key = [position.getX(i), position.getY(i), position.getZ(i)].map((value) => Math.round(value * 2000)).join(',');
      if (!weld.has(key)) weld.set(key, weld.size);
      return weld.get(key)!;
    };
    const edges = new Map<string, number>();
    for (let t = 0; t < index.count; t += 3) {
      const ids = [id(index.getX(t)), id(index.getX(t + 1)), id(index.getX(t + 2))];
      for (let e = 0; e < 3; e += 1) {
        const a = ids[e]!;
        const b = ids[(e + 1) % 3]!;
        if (a === b) continue;
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    expect([...edges.values()].filter((count) => count !== 2)).toEqual([]);
  });

  it('R57 the base is a cylinder of radius 0.5 with its edges rounded, and the ball rises above it', () => {
    const position = geometry.getAttribute('position');
    let widest = 0;
    let lowest = Infinity;
    for (let i = 0; i < position.count; i += 1) {
      widest = Math.max(widest, Math.hypot(position.getX(i), position.getZ(i)));
      lowest = Math.min(lowest, position.getY(i));
    }
    expect(widest).toBeCloseTo(0.5, 3);
    expect(lowest).toBeCloseTo(-0.5, 3);
    let wallTopRadius = 0;
    for (let i = 0; i < position.count; i += 1) if (Math.abs(position.getY(i) + 0.31) < 1e-6) wallTopRadius = Math.max(wallTopRadius, Math.hypot(position.getX(i), position.getZ(i)));
    expect(wallTopRadius).toBeLessThan(0.485); // the flat top stops short of the rim: the rim is a round bevel, not a corner
  });

  it('R57 R5 the ball sits on a pedestal: the geometry reaches below the ball and stays centred', () => {
    const box = boxOf(geometry);
    expect(box.min.y).toBeLessThan(-0.4);
    expect(box.max.y).toBeGreaterThan(0.3);
    expect((box.max.x + box.min.x) / 2).toBeCloseTo(0, 3);
    expect((box.max.z + box.min.z) / 2).toBeCloseTo(0, 3);
  });

  it('R57 every normal is unit length', () => {
    const normal = geometry.getAttribute('normal');
    for (let i = 0; i < normal.count; i += 1) {
      expect(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i))).toBeCloseTo(1, 4);
    }
  });
});
