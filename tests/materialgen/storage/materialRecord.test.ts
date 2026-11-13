import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESET_ID, MATERIAL_SCHEMA_VERSION, newMaterialRecord, referencedBlobKeys, summarizeMaterial, type MaterialRecord } from '@mat/storage/materialRecord';
import { DEFAULT_PREVIEW_VALUES } from '@mat/storage/previewValues';

const NOW = '2026-11-10T09:00:00.000Z';
const fresh = (size: 256 | 512 | 1024 | 2048 | null = null): MaterialRecord => newMaterialRecord({ id: 'm1', name: 'Mossy brick', size, now: NOW });

describe('materialRecord', () => {
  it('materialgen/app R25 a new project is an empty texture with default values', () => {
    expect(fresh(1024)).toEqual({
      schemaVersion: MATERIAL_SCHEMA_VERSION,
      id: 'm1',
      name: 'Mossy brick',
      createdAt: NOW,
      updatedAt: NOW,
      kind: 'texture',
      size: 1024,
      colorMode: 'albedo',
      prompt: '',
      referenceImages: [],
      presetId: DEFAULT_PRESET_ID,
      maps: {},
      preview: DEFAULT_PREVIEW_VALUES,
    });
  });

  it('materialgen/app R25 an unset size is kept as unset and the record has no masks', () => {
    const record = fresh();
    expect(record.size).toBeNull();
    expect('masks' in record).toBe(false);
  });

  it('materialgen/app R23a the list summary names the kind and size and carries no triangle count', () => {
    expect(summarizeMaterial(fresh(1024))).toEqual({ id: 'm1', name: 'Mossy brick', updatedAt: NOW, detail: 'Texture · 1024 px' });
    expect(summarizeMaterial(fresh()).detail).toBe('Texture · Size not set');
    expect('triangleCount' in summarizeMaterial(fresh())).toBe(false);
  });

  it('materialgen/app R35 a partly deleted project is listed as Partly deleted', () => {
    expect(summarizeMaterial({ ...fresh(1024), partlyDeleted: true }).detail).toBe('Partly deleted');
  });

  it('materialgen/app R23a the summary carries the thumbnail key when there is one', () => {
    expect(summarizeMaterial({ ...fresh(), thumbnailKey: 'thumbnail.jpg' }).thumbnailKey).toBe('thumbnail.jpg');
  });

  it('materialgen/app R34 the referenced keys are every map key, once, plus the reference images', () => {
    const record: MaterialRecord = {
      ...fresh(512),
      referenceImages: ['references/a.png'],
      maps: {
        albedo: { originalKey: 'maps/a1.png', workingKey: 'maps/a1.png', undoKey: null, width: 512, height: 512 },
        height: { originalKey: 'maps/h1.png', workingKey: 'maps/h2.png', undoKey: 'maps/h1.png', undo: { label: 'Filter' }, width: 512, height: 512 },
      },
    };
    expect([...referencedBlobKeys(record)].sort()).toEqual(['maps/a1.png', 'maps/h1.png', 'maps/h2.png', 'references/a.png']);
  });

  it('materialgen/app R37 the base of the Height offsets is a referenced file, on the map and on its undo entry, so export keeps it and the orphan sweep spares it', () => {
    const record: MaterialRecord = {
      ...fresh(512),
      maps: {
        height: {
          originalKey: 'maps/h1.png',
          workingKey: 'maps/h4.png',
          undoKey: 'maps/h3.png',
          undo: { label: 'Height offset', offsetBase: 'maps/h2.png' },
          offsetBase: 'maps/h5.png',
          width: 512,
          height: 512,
        },
      },
    };
    expect([...referencedBlobKeys(record)].sort()).toEqual(['maps/h1.png', 'maps/h2.png', 'maps/h3.png', 'maps/h4.png', 'maps/h5.png']);
  });
});
