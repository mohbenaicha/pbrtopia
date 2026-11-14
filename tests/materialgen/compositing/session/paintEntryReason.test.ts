import { describe, expect, it } from 'vitest';
import { paintEntryReason, type PaintEntryFacts } from '../../../../src/materialgen/compositing/session/paintEntryReason';

const ready: PaintEntryFacts = { mesh: 'plane', size: 1024, canWrite: true, readOnlyReason: 'Read only', otherEditOpen: false, mapsBusy: false, atlasFailed: false, previewReady: true };

describe('materialgen/compositing entry (R1 R36)', () => {
  it('R1 a Plane, a size, a writable project and no other edit let the painter open', () => {
    expect(paintEntryReason(ready)).toBeUndefined();
  });

  it('R1 each blocker gives its own reason', () => {
    expect(paintEntryReason({ ...ready, mesh: 'ball' })).toBe('Painting needs the Plane');
    expect(paintEntryReason({ ...ready, size: null })).toBe('Add a map first');
    expect(paintEntryReason({ ...ready, canWrite: false })).toBe('Read only');
    expect(paintEntryReason({ ...ready, otherEditOpen: true })).toMatch(/Another edit is open/);
  });

  it('R36 shapes that could not be loaded disable the entry with their own message', () => {
    expect(paintEntryReason({ ...ready, atlasFailed: true })).toBe('The brush shapes could not be loaded.');
  });
});
