import { describe, expect, it } from 'vitest';
import { DEFAULT_FEATHER, parseMasksRecord, serializeMasksRecord, type MaskRow, type MasksRecord } from '@mat/masks';

const row = (label: number): MaskRow => ({
  label, name: `Part ${label}`, description: 'd', location: 'l', defaultMaterial: 'Brick', top3: ['Brick'], matchKind: 'keyword', material: 'Brick', rough: 0.8, metal: 0,
});
const record = (): MasksRecord => ({
  source: 'model',
  palette: [{ label: 0, hex: '#ff0000', name: 'red' }, { label: 1, hex: '#00ff00', name: 'green' }],
  feather: 2,
  rows: [row(0), row(1)],
});

describe('materialgen/masks record', () => {
  it('R41 a saved record reads back exactly as it was written', () => {
    expect(parseMasksRecord(serializeMasksRecord(record()))).toEqual(record());
  });

  it('R41 anything that is not a usable record is no record, never a throw', () => {
    for (const bad of [undefined, null, 5, 'x', [], {}, { source: 'model' }, { ...record(), source: 'cloud' }, { ...record(), rows: [] }, { ...record(), palette: 'x' }]) {
      expect(parseMasksRecord(bad)).toBeNull();
    }
  });

  it('R41 a row with a value outside 0 to 1, or a label the palette does not have, makes the record unusable', () => {
    expect(parseMasksRecord({ ...record(), rows: [{ ...row(0), rough: 1.5 }, row(1)] })).toBeNull();
    expect(parseMasksRecord({ ...record(), rows: [row(0), row(7)] })).toBeNull();
    expect(parseMasksRecord({ ...record(), rows: [row(0), row(0)] })).toBeNull();
  });

  it('R54 a missing or out-of-range feather becomes the default or the nearest allowed value', () => {
    expect(parseMasksRecord({ ...record(), feather: undefined })?.feather).toBe(DEFAULT_FEATHER);
    expect(parseMasksRecord({ ...record(), feather: 9 })?.feather).toBe(4);
    expect(parseMasksRecord({ ...record(), feather: -3 })?.feather).toBe(0);
  });

  it('R41 an unknown match kind is read as generic', () => {
    const parsed = parseMasksRecord({ ...record(), rows: [{ ...row(0), matchKind: 'telepathy' }, row(1)] });
    expect(parsed?.rows[0]?.matchKind).toBe('generic');
  });

  it('R41 R21 a coverage figure stored by an older version is ignored, not kept', () => {
    const parsed = parseMasksRecord({ ...record(), coverage: 62.4 });
    expect(parsed).toEqual(record());
    expect(parsed).not.toHaveProperty('coverage');
  });
});
