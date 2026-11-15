import type { ShortcutSet } from '@shared/viewport';

/** App/shortcuts R5: the gestures of the paint tool, as `createPaintController` handles them (compositing R4, R12, R13, R37, R73). */
export const PAINT_SHORTCUTS: ShortcutSet = {
  id: 'paint',
  entries: [
    { keys: 'Left-drag', action: 'Paint' },
    { keys: 'Alt + click', action: 'Set the line marker' },
    { keys: 'Shift + click', action: 'Draw a straight line from the marker' },
    { keys: 'Alt + move sideways', action: 'Change the size' },
    { keys: 'Alt + wheel', action: 'Rotate the stamp' },
    { keys: 'Alt + Shift + wheel', action: 'Rotate by 1 degree' },
    { keys: 'Esc', action: 'Clear the marker' },
    { keys: 'Ctrl + Z', action: 'Undo' },
    { keys: 'Ctrl + Shift + Z', action: 'Redo' },
    { keys: 'Right-drag', action: 'Rotate the view' },
    { keys: 'Scroll', action: 'Zoom' },
  ],
};
