import { describe, expect, it } from 'vitest';
import { buildUprightSheet } from '../../../../src/generation/normal/buildUprightSheet';
import { buildOwnerMap } from '../../../../src/generation/normal/height/buildOwnerMap';
import { unpackHeight } from '../../../../src/generation/normal/height/unpackHeight';
import { quadMesh, solidPicture } from '../meshFixtures';

const SIDE = 64;
const CENTRE = 0.5;
const HALF = 0.2;

describe('unpackHeight', () => {
  const prepare = (turnDeg: number, mirrored = false) => {
    const mesh = quadMesh({ centre: [CENTRE, CENTRE], half: HALF, turnDeg, mirrored });
    const built = buildUprightSheet(solidPicture(SIDE, [200, 100, 50]), mesh);
    if (!built.ok) throw new Error('expected a sheet');
    return { mesh, sheet: built.value, owner: buildOwnerMap(mesh, SIDE) };
  };
  // a height rising up the sheet by 4 levels (of 255) per texel
  const rampUp = (side: number): Float32Array => Float32Array.from({ length: side * side }, (_, i) => Math.max(0, 255 - 4 * Math.floor(i / side)) / 255);

  for (const turnDeg of [0, 37, 90, 200, -123]) {
    it(`normal-height-edit R1 a height rising up the sheet on an island turned ${turnDeg} degrees rises along the island's own up direction in the albedo layout`, () => {
      const { sheet, owner } = prepare(turnDeg);
      const base = unpackHeight(rampUp(sheet.picture.side), sheet, owner);
      const a = (turnDeg * Math.PI) / 180;
      const up = { x: Math.sin(a), y: -Math.cos(a) };
      let checked = 0;
      for (let y = 20; y < 44; y += 1) {
        for (let x = 20; x < 44; x += 1) {
          // the island's interior only: the two-texel reach on each axis stays inside it (its border and growth are not a direction)
          if ([[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dy]) => owner[(y + dy!) * SIDE + x + dx!] === 0)) continue;
          const read = (px: number, py: number): number => base.rgba[(py * SIDE + px) * 4]!;
          const gx = read(x + 2, y) - read(x - 2, y);
          const gy = read(x, y + 2) - read(x, y - 2);
          const length = Math.hypot(gx, gy);
          if (length < 4) continue; // flat spots (rounding) are not a direction
          expect((gx * up.x + gy * up.y) / length).toBeGreaterThan(0.95);
          checked += 1;
        }
      }
      expect(checked).toBeGreaterThan(100);
    });
  }

  it('normal-height-edit R1 the picture is grey RGBA with alpha 255, at the albedo side, and texels of no island are 0', () => {
    const { sheet, owner } = prepare(0);
    const base = unpackHeight(rampUp(sheet.picture.side), sheet, owner);
    expect(base.side).toBe(SIDE);
    for (let i = 0; i < SIDE * SIDE; i += 1) {
      expect(base.rgba[i * 4]).toBe(base.rgba[i * 4 + 1]);
      expect(base.rgba[i * 4]).toBe(base.rgba[i * 4 + 2]);
      expect(base.rgba[i * 4 + 3]).toBe(255);
      if (owner[i] === 0) expect(base.rgba[i * 4]).toBe(0);
    }
  });

  it('normal-height-edit R1 an island whose texels the sheet left out (empty) stays 0 although the owner map owns it', () => {
    const { sheet, owner } = prepare(0);
    const trimmed = { ...sheet, pieces: [] };
    const base = unpackHeight(rampUp(sheet.picture.side), trimmed, owner);
    expect(Math.max(...Array.from({ length: SIDE * SIDE }, (_, i) => base.rgba[i * 4]!))).toBe(0);
  });

  it('normal-height-edit R1 a constant sheet height is a constant in the island (the bilinear sample adds nothing)', () => {
    const { sheet, owner } = prepare(37);
    const base = unpackHeight(new Float32Array(sheet.picture.side * sheet.picture.side).fill(0.5), sheet, owner);
    expect(base.rgba[(32 * SIDE + 32) * 4]).toBe(128); // round(0.5 * 255)
  });
});
