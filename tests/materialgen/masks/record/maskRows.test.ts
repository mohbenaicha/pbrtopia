import { describe, expect, it } from 'vitest';
import { parseBaseMaterials } from '@mat/masks/table/baseMaterials';
import { chooseMaterial, hasHeightOffset, isRowAtDefaults, makeRow, resetAllRows, resetRow, rowsToHeightOffsets, setRowValue, type MaskRow } from '@mat/masks/record/maskRows';

const TABLE = parseBaseMaterials({
  'Oak Wood': [0.7, 0, [120, 80, 40]],
  'Steel': [0.3, 1, [190, 190, 195]],
  'Rust': [0.85, 0.35, [140, 70, 30]],
});
const component = { name: 'planks', description: 'brown boards', location: 'left' };
const row = (patch: Partial<MaskRow> = {}): MaskRow => ({ ...makeRow({ label: 0, component, match: { material: 'Oak Wood', top3: ['Oak Wood', 'Rust', 'Steel'], kind: 'embedding' }, table: TABLE }), ...patch });

describe('materialgen/masks rows', () => {
  it('R39 a row starts with the roughness and metal of its base material, unrounded', () => {
    expect(row()).toMatchObject({ label: 0, name: 'planks', material: 'Oak Wood', defaultMaterial: 'Oak Wood', rough: 0.7, metal: 0, matchKind: 'embedding' });
    const rust = makeRow({ label: 1, component, match: { material: 'Rust', top3: [], kind: 'keyword' }, table: TABLE });
    expect([rust.rough, rust.metal]).toEqual([0.85, 0.35]);
  });

  it('R41 the row keeps the match, the top 3, the current material and the two current values', () => {
    expect(row().top3).toEqual(['Oak Wood', 'Rust', 'Steel']);
  });

  it('R13 a match naming a material that is not in the table becomes Generic', () => {
    const generic = makeRow({ label: 0, component, match: { material: 'Gone', top3: [], kind: 'keyword' }, table: TABLE });
    expect([generic.material, generic.rough, generic.metal]).toEqual(['Generic', 0.5, 0]);
  });

  it('R40 choosing another base material sets the row\'s roughness and metal to its values, dropping what was set', () => {
    const edited = setRowValue(row(), 'rough', 0.1);
    const chosen = chooseMaterial(edited, 'Steel', TABLE);
    expect([chosen.material, chosen.rough, chosen.metal]).toEqual(['Steel', 0.3, 1]);
    expect(chosen.defaultMaterial).toBe('Oak Wood');
  });

  it('R50 a slider value is kept to 0 to 1 in steps of 0.01', () => {
    expect(setRowValue(row(), 'rough', 0.456).rough).toBe(0.46);
    expect(setRowValue(row(), 'metal', 1.4).metal).toBe(1);
    expect(setRowValue(row(), 'metal', -3).metal).toBe(0);
    expect(setRowValue(row(), 'rough', Number.NaN).rough).toBe(0.7);
  });

  it('R52 a row is at its defaults when it has the matched material and that material\'s values', () => {
    expect(isRowAtDefaults(row(), TABLE)).toBe(true);
    expect(isRowAtDefaults(setRowValue(row(), 'rough', 0.2), TABLE)).toBe(false);
    expect(isRowAtDefaults(chooseMaterial(row(), 'Steel', TABLE), TABLE)).toBe(false);
  });

  it('R52 reset goes back to the matched material and its values', () => {
    const reset = resetRow(setRowValue(chooseMaterial(row(), 'Steel', TABLE), 'metal', 0.4), TABLE);
    expect([reset.material, reset.rough, reset.metal]).toEqual(['Oak Wood', 0.7, 0]);
    expect(isRowAtDefaults(reset, TABLE)).toBe(true);
  });

  it('R53 Reset all resets every row, and reports when there is nothing to reset', () => {
    const rows = [setRowValue(row(), 'rough', 0.2), row({ label: 1 }), chooseMaterial(row({ label: 2 }), 'Rust', TABLE)];
    const reset = resetAllRows(rows, TABLE);
    expect(reset.every((entry) => isRowAtDefaults(entry, TABLE))).toBe(true);
    expect(reset.map((entry) => entry.label)).toEqual([0, 1, 2]);
    expect(resetAllRows(reset, TABLE)).toEqual(reset);
  });
});

describe('materialgen/masks rows height offset (R81 R86)', () => {
  it('R81 a row starts at height 0, in the middle of -1 to +1', () => {
    expect(row().height).toBe(0);
  });

  it('R81 the height value is kept to steps of 0.01 within -1 and +1', () => {
    expect(setRowValue(row(), 'height', 0.456).height).toBe(0.46);
    expect(setRowValue(row(), 'height', -3).height).toBe(-1);
    expect(setRowValue(row(), 'height', 3).height).toBe(1);
    expect(setRowValue(row({ height: 0.5 }), 'height', Number.NaN).height).toBe(0.5);
  });

  it('R86 Reset puts the height back to 0, and a row with a height is not at its defaults', () => {
    const raised = row({ height: 0.4 });
    expect(isRowAtDefaults(raised, TABLE)).toBe(false);
    expect(resetRow(raised, TABLE).height).toBe(0);
    expect(resetAllRows([raised, row({ label: 1 })], TABLE).map((each) => each.height)).toEqual([0, 0]);
  });

  it('R86 choosing another base material leaves the height as it is', () => {
    expect(chooseMaterial(row({ height: -0.3 }), 'Steel', TABLE).height).toBe(-0.3);
  });

  it('R50 a roughness value still clamps to 0..1', () => {
    expect(setRowValue(row(), 'rough', -0.5).rough).toBe(0);
  });

  it('R82 the offsets the height bake reads are the rows heights in label order', () => {
    expect(rowsToHeightOffsets([row({ height: 0.5 }), row({ label: 1, height: -1 })])).toEqual([0.5, -1]);
  });

  it('R84 hasHeightOffset is true while any row is not at 0', () => {
    expect(hasHeightOffset([row(), row({ label: 1 })])).toBe(false);
    expect(hasHeightOffset([row(), row({ label: 1, height: 0.01 })])).toBe(true);
  });
});
