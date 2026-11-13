import { describe, expect, it } from 'vitest';
import type { MaskRow, MasksRecord } from '@mat/masks';
import { planMasksWrites } from '../../../../../src/materialgen/app/panels/masks/planMasksWrites';

const row = (label: number, patch: Partial<MaskRow> = {}): MaskRow => ({
  label, name: `Part ${label}`, description: '', location: '', defaultMaterial: 'Brick', top3: [], matchKind: 'keyword', material: 'Brick', rough: 0.8, metal: 0, height: 0, ...patch,
});
const record = (rows: MaskRow[], feather = 1): MasksRecord => ({ source: 'model', palette: rows.map((each) => ({ label: each.label, hex: '#000000', name: each.name })), feather, rows });

describe('materialgen/app planMasksWrites (masks R85 R87)', () => {
  const before = record([row(0), row(1, { height: 0.5 })]);

  it('R85 a change of height offsets alone writes Height alone', () => {
    expect(planMasksWrites(before, record([row(0), row(1, { height: 0.2 })]), false)).toEqual({ roughMetal: false, height: true });
  });

  it('R85 a roughness, metal or material change writes rough and metal and never Height', () => {
    expect(planMasksWrites(before, record([row(0, { rough: 0.1 }), row(1, { height: 0.5 })]), false)).toEqual({ roughMetal: true, height: false });
    expect(planMasksWrites(before, record([row(0), row(1, { height: 0.5, metal: 1 })]), false)).toEqual({ roughMetal: true, height: false });
    expect(planMasksWrites(before, record([row(0, { material: 'Steel' }), row(1, { height: 0.5 })]), false)).toEqual({ roughMetal: true, height: false });
  });

  it('R85 a feather change writes Height too while an offset is set, and not when every offset is 0', () => {
    expect(planMasksWrites(before, { ...before, feather: 3 }, false)).toEqual({ roughMetal: true, height: true });
    const flat = record([row(0), row(1)]);
    expect(planMasksWrites(flat, { ...flat, feather: 3 }, false)).toEqual({ roughMetal: true, height: false });
  });

  it('R87 rebuilt labels write Height too while an offset is set', () => {
    expect(planMasksWrites(before, before, true)).toEqual({ roughMetal: true, height: true });
    const flat = record([row(0), row(1)]);
    expect(planMasksWrites(flat, flat, true)).toEqual({ roughMetal: true, height: false });
  });

  it('R86 Reset all (a roughness change and every offset to 0) writes both', () => {
    expect(planMasksWrites(record([row(0, { rough: 0.1, height: 0.4 })]), record([row(0)]), false)).toEqual({ roughMetal: true, height: true });
  });

  it('R50 a change that alters nothing still bakes rough and metal, as before, and writes no Height', () => {
    expect(planMasksWrites(before, before, false)).toEqual({ roughMetal: true, height: false });
  });

  it('R92 a change of the colour mixin alone writes rough and metal and never Height', () => {
    const mixed = record([row(0, { mix: { on: true, invert: false, rough: 0.5, metal: 0.5 } }), row(1, { height: 0.5 })]);
    expect(planMasksWrites(before, mixed, false)).toEqual({ roughMetal: true, height: false });
    const moved = record([row(0, { mix: { on: true, invert: true, rough: 0.9, metal: 0.5 } }), row(1, { height: 0.5 })]);
    expect(planMasksWrites(mixed, moved, false)).toEqual({ roughMetal: true, height: false });
  });
});
