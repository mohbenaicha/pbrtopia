import { describe, expect, it } from 'vitest';
import { DEFAULT_FEATHER, parseMasksRecord, serializeMasksRecord, type MaskRow, type MasksRecord } from '@mat/masks';

const row = (label: number): MaskRow => ({
  label, name: `Part ${label}`, description: 'd', location: 'l', defaultMaterial: 'Brick', top3: ['Brick'], matchKind: 'keyword', material: 'Brick', rough: 0.8, metal: 0, height: 0,
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

  it('R88 the height offsets are saved with the record and read back, also negative ones', () => {
    const raised: MasksRecord = { ...record(), rows: [{ ...row(0), height: 0.35 }, { ...row(1), height: -1 }] };
    expect(parseMasksRecord(serializeMasksRecord(raised))).toEqual(raised);
  });

  it('R88 a record saved before the height offsets existed reads with every height at 0; a height outside -1 to +1 makes it unusable', () => {
    const { height: _height, ...old } = row(0);
    expect(parseMasksRecord({ ...record(), rows: [old, row(1)] })?.rows[0]?.height).toBe(0);
    expect(parseMasksRecord({ ...record(), rows: [{ ...row(0), height: 1.5 }, row(1)] })).toBeNull();
    expect(parseMasksRecord({ ...record(), rows: [{ ...row(0), height: -1.5 }, row(1)] })).toBeNull();
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
