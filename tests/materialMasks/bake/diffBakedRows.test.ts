import { describe, expect, it } from 'vitest';
import { findChangedMaps } from '../../../src/materialMasks/bake/diffBakedRows';
import type { BakeRow } from '../../../src/materialMasks';

const rows = (): BakeRow[] => [{ rough: 0.2, metal: 0.9 }, { rough: 0.5, metal: 0.1 }, { rough: 0.7, metal: 0.3, mix: { invert: false, rough: 0.4, metal: 0 } }];

describe('findChangedMaps (mask-bake-session R4)', () => {
  it('mask-bake-session R4 a roughness change of one label changes only the roughness map and that label', () => {
    const wanted = rows();
    wanted[1] = { ...wanted[1]!, rough: 0.6 };
    expect(findChangedMaps({ rows: rows(), feather: 1 }, { rows: wanted, feather: 1 })).toEqual({ maps: ['rough'], labels: [1] });
  });

  it('mask-bake-session R4 a metalness change of one label changes only the metal map and that label', () => {
    const wanted = rows();
    wanted[0] = { ...wanted[0]!, metal: 0.4 };
    expect(findChangedMaps({ rows: rows(), feather: 1 }, { rows: wanted, feather: 1 })).toEqual({ maps: ['metal'], labels: [0] });
  });

  it('mask-bake-session R4 a change that gives the same table byte is no change', () => {
    const wanted = rows();
    wanted[0] = { ...wanted[0]!, rough: 0.2 + 0.0004 };
    expect(findChangedMaps({ rows: rows(), feather: 1 }, { rows: wanted, feather: 1 })).toBeNull();
  });

  it('mask-bake-session R4 a Colour mixin amount for one map changes that map only; turning it on with an amount of 0 for a map changes nothing for it', () => {
    const base = rows();
    const wanted = rows();
    wanted[0] = { ...wanted[0]!, mix: { invert: false, rough: 0, metal: 0.5 } };
    expect(findChangedMaps({ rows: base, feather: 1 }, { rows: wanted, feather: 1 })).toEqual({ maps: ['metal'], labels: [0] });
  });

  it('mask-bake-session R4 inverting a mixin changes the maps whose amount is not 0', () => {
    const wanted = rows();
    wanted[2] = { ...wanted[2]!, mix: { invert: true, rough: 0.4, metal: 0 } };
    expect(findChangedMaps({ rows: rows(), feather: 1 }, { rows: wanted, feather: 1 })).toEqual({ maps: ['rough'], labels: [2] });
  });

  it('mask-bake-session R4 a change of both values of one label names both maps', () => {
    const wanted = rows();
    wanted[1] = { rough: 0.9, metal: 0.9 };
    expect(findChangedMaps({ rows: rows(), feather: 1 }, { rows: wanted, feather: 1 })).toEqual({ maps: ['rough', 'metal'], labels: [1] });
  });

  it('mask-bake-session R4 a feather change names both maps and every label', () => {
    expect(findChangedMaps({ rows: rows(), feather: 1 }, { rows: rows(), feather: 3 })).toEqual({ maps: ['rough', 'metal'], labels: 'all' });
  });

  it('mask-bake-session R4 a feather that rounds and clamps to the same radius is no change', () => {
    expect(findChangedMaps({ rows: rows(), feather: 4 }, { rows: rows(), feather: 9 })).toBeNull();
    expect(findChangedMaps({ rows: rows(), feather: 1 }, { rows: rows(), feather: 1.2 })).toBeNull();
  });

  it('mask-bake-session R4 a change of a different number of rows names both maps and every label', () => {
    expect(findChangedMaps({ rows: rows(), feather: 1 }, { rows: rows().slice(0, 2), feather: 1 })).toEqual({ maps: ['rough', 'metal'], labels: 'all' });
  });

  it('mask-bake-session R4 an edit back to the earlier value (A to B to A) is no change', () => {
    expect(findChangedMaps({ rows: rows(), feather: 1 }, { rows: rows(), feather: 1 })).toBeNull();
  });

  it('mask-bake-session R4 a change of every label names all labels', () => {
    const wanted = rows().map((row) => ({ ...row, rough: 0.05 }));
    expect(findChangedMaps({ rows: rows(), feather: 1 }, { rows: wanted, feather: 1 })).toEqual({ maps: ['rough'], labels: 'all' });
  });
});
