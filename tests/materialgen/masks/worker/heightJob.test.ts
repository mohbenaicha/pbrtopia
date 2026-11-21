import { describe, expect, it } from 'vitest';
import type { MasksRecord, PixelImage } from '@shared/materialMasks';
import { runHeightJob, startHeightJob } from '../../../../src/materialgen/masks/worker/heightJob';

// The height job stayed in materialgen when the mask core moved out (material-masks-core R3, masks R82).
const halves: PixelImage = { width: 8, height: 8, channels: 1, data: Uint8Array.from({ length: 64 }, (_, i) => (i % 8 < 4 ? 0 : 1)) };
const base: PixelImage = { width: 8, height: 8, channels: 1, data: new Uint8Array(64).fill(100) };
const record: MasksRecord = {
  source: 'model',
  palette: [{ label: 0, hex: '#FF0000', name: 'red' }, { label: 1, hex: '#00FF00', name: 'green' }],
  feather: 0,
  rows: [
    { label: 0, name: 'Wall', description: '', location: '', defaultMaterial: 'Brick', top3: ['Brick'], matchKind: 'colour', material: 'Brick', rough: 0.8, metal: 0, height: 0 },
    { label: 1, name: 'Plate', description: '', location: '', defaultMaterial: 'Steel', top3: ['Steel'], matchKind: 'colour', material: 'Steel', rough: 0.3, metal: 1, height: 1 },
  ],
};

describe('materialgen/masks heightJob (masks R82, material-masks-core R3)', () => {
  it('material-masks-core R3 runHeightJob adds each label offset to the base and leaves offset-free labels alone', () => {
    const out = runHeightJob({ labels: halves, record, base });
    expect(out.data[7]).toBe(164);
    expect(out.data[0]).toBe(100);
  });

  it('material-masks-core R3 startHeightJob without Worker support runs in the page and gives the same picture', async () => {
    const out = await startHeightJob({ labels: halves, record, base });
    expect(Array.from(out.data)).toEqual(Array.from(runHeightJob({ labels: halves, record, base }).data));
  });
});
