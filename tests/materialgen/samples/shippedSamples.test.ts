import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { streamOf } from '../../support/zipStreams';
import { createTestMaterialStore } from '../storage/materialStoreFixtures';
import { BUNDLED_SAMPLES } from '@mat/samples/bundledSamples';
import { importMaterialZip } from '@mat/storage/zip/importMaterialZip';

const FOLDER = resolve(__dirname, '../../../src/materialgen/data/default-projects');
const NAMES = ['Corrugated-Metal', 'Fungal-Bark', 'Rocky-Desert', 'Rotting-Wood'];

describe('the shipped sample zips (materialgen/default-projects R1, R2)', () => {
  it('TestR1_the_four_samples_are_there', () => {
    expect(readdirSync(FOLDER).filter((name) => name.endsWith('.zip')).sort()).toEqual(NAMES.map((name) => `${name}.zip`));
  });

  it('TestR11_the_build_lists_the_four_zips_as_static_files_in_name_order', () => {
    expect(BUNDLED_SAMPLES.map((sample) => sample.name)).toEqual(NAMES);
  });

  it.each(NAMES)('TestR2_%s_is_read_by_the_ordinary_import_with_masks_and_all_maps', async (name) => {
    const test = await createTestMaterialStore();
    const bytes = new Uint8Array(readFileSync(join(FOLDER, `${name}.zip`)));
    const imported = await importMaterialZip(test.store, streamOf(bytes, 1 << 20), undefined, { appId: 'material-lab' });
    if (!imported.ok) throw new Error(imported.error.message);
    expect(imported.value.name).toBe(name);
    expect(Object.keys(imported.value.maps)).toEqual(expect.arrayContaining(['albedo', 'normal', 'height', 'rough', 'metal', 'labels']));
    expect(imported.value.masks).toBeDefined();
    expect(await test.store.loadThumbnail(imported.value.id)).not.toBeNull(); // the export's preview picture (R8)
  });
});
