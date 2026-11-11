import { describe, expect, it } from 'vitest';
import { MATERIAL_SCHEMA_VERSION, newMaterialRecord, type MaterialRecord } from '@mat/storage/materialRecord';
import { migrateMaterialRecord } from '@mat/storage/readMaterialRecord';

const NOW = '2026-11-10T09:00:00.000Z';
const full = (): MaterialRecord => ({
  ...newMaterialRecord({ id: 'm1', name: 'Mossy brick', size: 1024, now: NOW }),
  thumbnailKey: 'thumbnail.jpg',
  prompt: 'mossy brick wall',
  referenceImages: ['references/a.png'],
  maps: {
    albedo: { originalKey: 'maps/a1.png', workingKey: 'maps/a2.png', undoKey: 'maps/a1.png', undo: { label: 'Filter', groupId: 'g1', size: 512 }, width: 1024, height: 1024 },
    ao: { originalKey: 'maps/o1.png', workingKey: 'maps/o1.png', undoKey: null, width: 1024, height: 1024, derivedFrom: { kind: 'height', key: 'maps/h1.png' } },
  },
});
const raw = (record: unknown): unknown => JSON.parse(JSON.stringify(record));
const rejected = (value: unknown) => {
  const result = migrateMaterialRecord(value);
  if (result.ok) throw new Error('expected a refusal');
  return result.error;
};

describe('migrateMaterialRecord', () => {
  it('materialgen/app R26 a stored record reads back equal', () => {
    const result = migrateMaterialRecord(raw(full()));
    expect(result).toEqual({ ok: true, value: full() });
  });

  it('materialgen/maps R44 the source of a map (generated, computed or dropped with the file name) reads back', () => {
    const base = full();
    const withSource = (source: unknown): unknown => raw({ ...base, maps: { ...base.maps, ao: { ...base.maps.ao, source } } });
    for (const source of [{ kind: 'generated' }, { kind: 'computed' }, { kind: 'dropped', name: 'brick.jpg' }]) {
      const result = migrateMaterialRecord(withSource(source));
      expect(result.ok && result.value.maps.ao?.source).toEqual(source);
    }
  });

  it('materialgen/maps R44 a source with an unknown kind, a dropped source without a name or a data URI name is refused', () => {
    const base = full();
    const withSource = (source: unknown): unknown => raw({ ...base, maps: { ...base.maps, ao: { ...base.maps.ao, source } } });
    expect(rejected(withSource({ kind: 'magic' }))).toBeTruthy();
    expect(rejected(withSource({ kind: 'dropped' }))).toBeTruthy();
    expect(rejected(withSource({ kind: 'dropped', name: `data:image/png;base64,${'A'.repeat(40)}` }))).toBeTruthy();
  });

  it('materialgen/app R26 saved setups, the custom plan, masks and AO parameters are kept as stored', () => {
    const record = { ...full(), customPlan: { images: [1] }, savedSetups: [{ name: 'mine' }], masks: { feather: 2 }, aoParams: { radius: 4 } };
    expect(migrateMaterialRecord(raw(record))).toEqual({ ok: true, value: record });
  });

  it('materialgen/app R28 a record saved by a newer version is refused and says so', () => {
    const error = rejected({ ...full(), schemaVersion: MATERIAL_SCHEMA_VERSION + 1 });
    expect(error).toEqual({ code: 'schema-too-new', message: 'This project was saved by a newer version.' });
  });

  it('materialgen/app R28 a record without a version number is corrupt', () => {
    const record: Partial<MaterialRecord> = full();
    delete record.schemaVersion;
    expect(rejected(record).code).toBe('corrupt');
  });

  it('materialgen/app R29 a field holding image data is refused', () => {
    expect(rejected({ ...full(), prompt: `data:image/png;base64,${'A'.repeat(200)}` }).message).toMatch(/^Invalid project\./);
  });

  it('materialgen/app R29 image data nested inside savedSetups, customPlan, masks or aoParams is refused too', () => {
    const data = `data:image/png;base64,${'A'.repeat(50)}`;
    const long = 'x'.repeat(100_001);
    const base = full();
    expect(rejected({ ...base, savedSetups: [{ name: 'a', plan: { cards: [{ note: data }] } }] }).message).toMatch(/^Invalid project\./);
    expect(rejected({ ...base, customPlan: { cards: [{ items: [{ label: data }] }] } }).message).toMatch(/^Invalid project\./);
    expect(rejected({ ...base, masks: { components: [{ description: long }] } }).message).toMatch(/^Invalid project\./);
    expect(rejected({ ...base, aoParams: { nested: { deeper: [data] } } }).message).toMatch(/^Invalid project\./);
  });

  it('materialgen/app R29 a data URI is refused in any letter case, and as a key', () => {
    const base = full();
    expect(rejected({ ...base, customPlan: { note: 'DATA:image/png;base64,AAAA' } }).message).toMatch(/^Invalid project\./);
    expect(rejected({ ...base, customPlan: { 'data:image/png;base64,AAAA': 1 } }).message).toMatch(/^Invalid project\./);
  });

  it('materialgen/app R29 prose that starts with the word data is not image data', () => {
    const base = { ...full(), prompt: 'data: a brick wall', customPlan: { note: 'data: keep this' } };
    expect(migrateMaterialRecord(raw(base)).ok).toBe(true);
  });

  it('materialgen/app R29 absurdly deep nesting is refused as an invalid project, not thrown', () => {
    let deep: Record<string, unknown> = {};
    const root = deep;
    for (let i = 0; i < 5000; i += 1) deep = (deep['next'] = {}) as Record<string, unknown>;
    expect(rejected({ ...full(), customPlan: root }).message).toMatch(/^Invalid project\./);
  });

  it('materialgen/app R29 ordinary nested plan text and numbers are kept', () => {
    const base = { ...full(), customPlan: { cards: [{ itemIds: [0, 1], note: 'data is fine in the middle of a sentence' }] } };
    const result = migrateMaterialRecord(raw(base));
    expect(result.ok && result.value.customPlan).toEqual(base.customPlan);
  });

  it('materialgen/app R29 a blob key that is not a plain relative path is refused', () => {
    const record = full();
    expect(rejected({ ...record, referenceImages: ['../escape.png'] }).code).toBe('corrupt');
    expect(rejected({ ...record, maps: { albedo: { ...record.maps.albedo, workingKey: 'C:/x.png' } } }).code).toBe('corrupt');
  });

  it('materialgen/maps R6 a labels map never has an undo entry', () => {
    const labels = { originalKey: 'maps/l1.png', workingKey: 'maps/l2.png', undoKey: 'maps/l1.png', undo: { label: 'x' }, width: 8, height: 8 };
    expect(rejected({ ...full(), maps: { labels } }).code).toBe('corrupt');
  });

  it('materialgen/maps R8 a map with an undo key but no undo entry is refused', () => {
    const albedo = { originalKey: 'maps/a1.png', workingKey: 'maps/a2.png', undoKey: 'maps/a1.png', width: 8, height: 8 };
    expect(rejected({ ...full(), maps: { albedo } }).code).toBe('corrupt');
  });

  it('materialgen/app R26 an unknown map kind or size is refused', () => {
    expect(rejected({ ...full(), maps: { sparkle: full().maps.albedo } }).code).toBe('corrupt');
    expect(rejected({ ...full(), size: 300 }).code).toBe('corrupt');
  });

  it('materialgen/preview R34 stored preview values out of range are clamped on load', () => {
    const result = migrateMaterialRecord(raw({ ...full(), preview: { tilingX: 50, heightScale: -1 } }));
    expect(result.ok && result.value.preview).toMatchObject({ tilingX: 10, heightScale: 0, tilingY: 1 });
  });

  it('materialgen/app R26 fields this version does not know are dropped', () => {
    const result = migrateMaterialRecord(raw({ ...full(), future: 1 }));
    expect(result.ok && 'future' in result.value).toBe(false);
  });
});
