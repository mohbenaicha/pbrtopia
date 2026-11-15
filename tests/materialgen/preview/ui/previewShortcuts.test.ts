import { describe, expect, it } from 'vitest';
import { PAINT_SHORTCUTS } from '../../../../src/materialgen/compositing/ui/paintShortcuts';
import { PREVIEW_SHORTCUTS } from '../../../../src/materialgen/preview/ui/previewShortcuts';

const pairs = (set: { entries: readonly { keys: string; action: string }[] }): string[] => set.entries.map((entry) => `${entry.keys} | ${entry.action}`);

describe('app/shortcuts the material sets (R5)', () => {
  it('R5 the preview turns by dragging and zooms by scrolling (preview R21)', () => {
    expect(pairs(PREVIEW_SHORTCUTS)).toEqual(['Drag | Rotate', 'Scroll | Zoom']);
  });

  it('R5 the paint set names every gesture the paint controller handles', () => {
    expect(pairs(PAINT_SHORTCUTS)).toEqual([
      'Left-drag | Paint',
      'Alt + click | Set the line marker',
      'Shift + click | Draw a straight line from the marker',
      'Alt + move sideways | Change the size',
      'Alt + wheel | Rotate the stamp',
      'Alt + Shift + wheel | Rotate by 1 degree',
      'Esc | Clear the marker',
      'Ctrl + Z | Undo',
      'Ctrl + Shift + Z | Redo',
      'Right-drag | Rotate the view',
      'Scroll | Zoom',
    ]);
  });
});
