import type { ShortcutSet } from '@shared/viewport';

/** App/shortcuts R5: the preview with no tool open turns by dragging and zooms by scrolling (preview R21). */
export const PREVIEW_SHORTCUTS: ShortcutSet = {
  id: 'preview',
  entries: [
    { keys: 'Drag', action: 'Rotate' },
    { keys: 'Scroll', action: 'Zoom' },
  ],
};
