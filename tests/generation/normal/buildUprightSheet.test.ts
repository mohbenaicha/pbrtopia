import { describe, expect, it } from 'vitest';
import { buildUprightSheet, isEmptyIsland } from '../../../src/generation/normal/buildUprightSheet';
import { NO_BAKED_AREA, SHEET_TOO_SMALL } from '../../../src/generation/normal/uprightTypes';
import { joinMeshes, pixelAt, quadMesh, solidPicture } from './meshFixtures';

const LIT: [number, number, number] = [200, 100, 50];

describe('buildUprightSheet', () => {
  it('normal-map R15 an island is empty below 5% non-black texels and kept at 5%', () => {
    expect(isEmptyIsland(49, 1000)).toBe(true);
    expect(isEmptyIsland(50, 1000)).toBe(false);
    expect(isEmptyIsland(0, 0)).toBe(true);
  });

  it('normal-map R15 black is an R+G+B sum of 24 or less', () => {
    const mesh = quadMesh({ centre: [0.5, 0.5], half: 0.2 });
    expect(buildUprightSheet(solidPicture(64, [8, 8, 8]), mesh)).toMatchObject({ ok: false, error: { message: NO_BAKED_AREA } });
    expect(buildUprightSheet(solidPicture(64, [8, 8, 9]), mesh).ok).toBe(true);
  });

  it('normal-map R15 a model with no baked area is refused with the exact message', () => {
    const result = buildUprightSheet(solidPicture(64, [0, 0, 0]), quadMesh({ centre: [0.5, 0.5], half: 0.2 }));
    expect(result).toEqual({ ok: false, error: { category: 'validation', retryable: false, message: 'The albedo has no baked area to read relief from.' } });
  });

  it('normal-map R15 a UV layout reaching outside the picture, or holding a NaN, is refused before any work with the exact message', () => {
    const refused = { ok: false, error: { category: 'validation', retryable: false, message: 'The UV layout reaches outside the picture.' } };
    const tiled = quadMesh({ centre: [25, 0.5], half: 25 }); // u from 0 to 50: a tiled layout
    expect(buildUprightSheet(solidPicture(64, LIT), tiled)).toEqual(refused);
    const broken = quadMesh({ centre: [0.5, 0.5], half: 0.2 });
    broken.uvs[3] = Number.NaN;
    expect(buildUprightSheet(solidPicture(64, LIT), broken)).toEqual(refused);
    const slightly = quadMesh({ centre: [0.5, 0.5], half: 0.505 }); // 0.5% outside is still read
    expect(buildUprightSheet(solidPicture(64, LIT), slightly).ok).toBe(true);
  });

  it('normal-map R15 an empty island is left out of the sheet while a lit one stays', () => {
    const source = solidPicture(100, [0, 0, 0]);
    // light only the left island's pixels
    for (let y = 0; y < 100; y += 1) for (let x = 0; x < 50; x += 1) source.rgba.set([...LIT, 255], (y * 100 + x) * 4);
    const mesh = joinMeshes(quadMesh({ centre: [0.25, 0.5], half: 0.15, at: 0 }), quadMesh({ centre: [0.75, 0.5], half: 0.15, at: 1 }));
    const result = buildUprightSheet(source, mesh);
    expect(result.ok && result.value.pieces.map((p) => p.index)).toEqual([0]);
  });

  it('normal-map R17 the sheet has the source side and its pieces carry the island pixels on black', () => {
    const result = buildUprightSheet(solidPicture(64, LIT), quadMesh({ centre: [0.5, 0.5], half: 0.2 }));
    if (!result.ok) throw new Error('expected a sheet');
    const { picture, pieces, scale } = result.value;
    expect(picture.side).toBe(64);
    expect(scale).toBe(1);
    const p = pieces[0]!.sheet;
    expect(pixelAt(picture, p.x + Math.floor(p.width / 2), p.y + Math.floor(p.height / 2))).toEqual(LIT);
    expect(pixelAt(picture, 0, 0)).toEqual([0, 0, 0]); // the 4 px edge stays black
  });

  it('normal-map R17 pieces never overlap, keep 4 px apart and stay inside the sheet edges', () => {
    const quads = [0, 1, 2, 3, 4].map((k) => quadMesh({ centre: [0.2 + 0.15 * k, 0.5], half: 0.05 + 0.01 * k, turnDeg: 20 * k, at: k }));
    const result = buildUprightSheet(solidPicture(128, LIT), joinMeshes(...quads));
    if (!result.ok) throw new Error('expected a sheet');
    const boxes = result.value.pieces.map((p) => p.sheet);
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(4);
      expect(b.y).toBeGreaterThanOrEqual(4);
      expect(b.x + b.width + 4).toBeLessThanOrEqual(128);
      expect(b.y + b.height + 4).toBeLessThanOrEqual(128);
    }
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const apartX = a.x + a.width + 4 <= b.x || b.x + b.width + 4 <= a.x;
        const apartY = a.y + a.height + 4 <= b.y || b.y + b.height + 4 <= a.y;
        expect(apartX || apartY).toBe(true);
      }
    }
  });

  it('normal-map R17 pieces are placed tallest first', () => {
    const mesh = joinMeshes(quadMesh({ centre: [0.2, 0.3], half: 0.05, at: 0 }), quadMesh({ centre: [0.6, 0.5], half: 0.2, at: 1 }));
    const result = buildUprightSheet(solidPicture(128, LIT), mesh);
    if (!result.ok) throw new Error('expected a sheet');
    const [small, big] = [result.value.pieces.find((p) => p.index === 0)!, result.value.pieces.find((p) => p.index === 1)!];
    expect(big.sheet.y === small.sheet.y ? big.sheet.x < small.sheet.x : big.sheet.y < small.sheet.y).toBe(true);
  });

  it('normal-map R17 all pieces scale by one factor of at most 1 in steps of 0.02', () => {
    const quads = [0, 1, 2, 3].map((k) => quadMesh({ centre: [0.5, 0.5], half: 0.45, at: k })); // four near-full-sheet pieces cannot fit at scale 1
    const result = buildUprightSheet(solidPicture(128, LIT), joinMeshes(...quads));
    if (!result.ok) throw new Error('expected a sheet');
    expect(result.value.scale).toBeLessThan(1);
    expect(result.value.scale).toBeGreaterThanOrEqual(0.3);
    expect(Math.round((1 - result.value.scale) / 0.02) * 0.02).toBeCloseTo(1 - result.value.scale, 9);
  });

  it('normal-map R17 islands that cannot fit even at scale 0.3 are refused with the exact message', () => {
    const quads = Array.from({ length: 20 }, (_, k) => quadMesh({ centre: [0.5, 0.5], half: 0.5, at: k }));
    const result = buildUprightSheet(solidPicture(64, LIT), joinMeshes(...quads));
    expect(result).toEqual({ ok: false, error: { category: 'validation', retryable: false, message: 'The islands do not fit one sheet.' } });
    expect(SHEET_TOO_SMALL).toBe('The islands do not fit one sheet.');
  });

  it('normal-map R16 the sheet content is turned so world up is the picture top', () => {
    // a source whose lit pixels are only the upper half of the quad's own picture axes; after the 90 degree turn they show on the sheet's piece top
    const source = solidPicture(100, [0, 0, 0]);
    // quad centred at (0.5,0.5), half 0.3, turned 90 degrees clockwise: world up points to the picture's right, so the world-top is the right half
    for (let y = 0; y < 100; y += 1) for (let x = 50; x < 100; x += 1) source.rgba.set([...LIT, 255], (y * 100 + x) * 4);
    const result = buildUprightSheet(source, quadMesh({ centre: [0.5, 0.5], half: 0.3, turnDeg: 90 }));
    if (!result.ok) throw new Error('expected a sheet');
    const p = result.value.pieces[0]!.sheet;
    const top = pixelAt(result.value.picture, p.x + Math.floor(p.width / 2), p.y + Math.floor(p.height * 0.25));
    const bottom = pixelAt(result.value.picture, p.x + Math.floor(p.width / 2), p.y + Math.floor(p.height * 0.75));
    expect(top).toEqual(LIT);
    expect(bottom).toEqual([0, 0, 0]);
  });

  it('normal-map R20 the same inputs give the same sheet', () => {
    const mesh = quadMesh({ centre: [0.5, 0.5], half: 0.25, turnDeg: 33 });
    const a = buildUprightSheet(solidPicture(64, LIT), mesh);
    const b = buildUprightSheet(solidPicture(64, LIT), mesh);
    if (!a.ok || !b.ok) throw new Error('expected sheets');
    expect(Array.from(a.value.picture.rgba)).toEqual(Array.from(b.value.picture.rgba));
  });
});
