import { describe, expect, it } from 'vitest';
import { measureUpTurn } from '../../../src/generation/normal/measureUpTurn';
import { joinMeshes, quadMesh, type QuadOptions } from './meshFixtures';

const toDeg = (rad: number): number => (rad * 180) / Math.PI;
// angle difference folded to -180..180
const diff = (a: number, b: number): number => ((((a - b) % 360) + 540) % 360) - 180;
const turnOf = (o: QuadOptions): number => {
  const mesh = quadMesh(o);
  return toDeg(measureUpTurn(mesh, [0, 1]));
};

describe('measureUpTurn', () => {
  it('normal-map R16 an upright quad needs no turn', () => {
    expect(Math.abs(diff(turnOf({ centre: [0.5, 0.5], half: 0.2 }), 0))).toBeLessThan(0.01);
  });

  it('normal-map R16 a quad whose up appears 30 degrees clockwise from the picture top is turned 30 degrees back', () => {
    expect(Math.abs(diff(turnOf({ centre: [0.5, 0.5], half: 0.2, turnDeg: 30 }), -30))).toBeLessThan(0.01);
    expect(Math.abs(diff(turnOf({ centre: [0.5, 0.5], half: 0.2, turnDeg: 200 }), -200))).toBeLessThan(0.01);
  });

  it('normal-map R16 a mirrored quad is turned by its up angle and never flipped', () => {
    expect(Math.abs(diff(turnOf({ centre: [0.5, 0.5], half: 0.2, turnDeg: 75, mirrored: true }), -75))).toBeLessThan(0.01);
  });

  it('normal-map R16 a stretched island is measured as drawn in the picture, not in unit model axes', () => {
    // up appears 45 degrees off the picture top; drawing the u axis twice as long makes it appear atan2(2, 1) = 63.43 degrees off
    const stretched = turnOf({ centre: [0.5, 0.5], half: 0.1, turnDeg: 45, stretchU: 2 });
    expect(Math.abs(diff(stretched, -63.4349))).toBeLessThan(0.01);
    expect(Math.abs(diff(turnOf({ centre: [0.5, 0.5], half: 0.1, turnDeg: 45, stretchU: 1 }), -45))).toBeLessThan(0.01);
  });

  it('normal-map R16 an island of only horizontal faces gets turn 0', () => {
    expect(turnOf({ centre: [0.5, 0.5], half: 0.2, turnDeg: 80, floor: true })).toBe(0);
  });

  it('normal-map R16 a bigger triangle outweighs a smaller one in the circular mean', () => {
    const big = quadMesh({ centre: [0.3, 0.3], half: 0.3, turnDeg: 40, at: 0 });
    const small = quadMesh({ centre: [0.8, 0.8], half: 0.05, turnDeg: 100, at: 1 });
    const mesh = joinMeshes(big, small); // measured over both quads' triangles as if they were one island
    const turn = toDeg(measureUpTurn(mesh, [0, 1, 2, 3]));
    expect(Math.abs(diff(turn, -40))).toBeLessThan(6); // pulled a little towards the small quad, mostly the big one
    expect(Math.abs(diff(turn, -40))).toBeGreaterThan(0.01);
  });

  it('normal-map R16 faces tipped past the 0.3 up-projection limit are ignored', () => {
    // a wall laid almost flat: the up vector's projection into its plane is about 0.1 long
    const mesh = quadMesh({ centre: [0.5, 0.5], half: 0.2, turnDeg: 50 });
    const positions = new Float32Array(mesh.positions);
    for (let v = 0; v < 4; v += 1) {
      const y = positions[v * 3 + 1]!;
      positions[v * 3 + 1] = y * 0.1;
      positions[v * 3 + 2] = y;
    }
    expect(measureUpTurn({ ...mesh, positions }, [0, 1])).toBe(0);
  });
});
