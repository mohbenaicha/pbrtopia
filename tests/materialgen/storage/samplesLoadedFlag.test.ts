import { describe, expect, it } from 'vitest';
import { readMaterialSettings } from '@mat/storage/materialSettings';
import { createTestMaterialStore } from './materialStoreFixtures';

describe('the samples-loaded flag in the app settings (materialgen/default-projects R11)', () => {
  it('TestR11_it_starts_false_is_kept_once_saved_and_survives_other_settings_saves', async () => {
    const test = await createTestMaterialStore();
    expect((await test.store.loadAppSettings()).samplesLoaded).toBe(false);
    await test.store.saveAppSettings({ samplesLoaded: true });
    await test.store.saveAppSettings({ lastOpenProjectId: 'id-1' });
    expect((await test.store.loadAppSettings()).samplesLoaded).toBe(true);
  });

  it('TestR11_a_damaged_value_reads_as_not_loaded', () => {
    expect(readMaterialSettings({ samplesLoaded: 'yes' }).samplesLoaded).toBe(false);
  });
});
