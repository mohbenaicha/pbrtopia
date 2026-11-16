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

/** Clone R18: the gestures of the Clone tool, as `createCloneMode` handles them (clone R4, R5, R9, R12, R13, R16). */
export const CLONE_SHORTCUTS: ShortcutSet = {
  id: 'paint-clone',
  entries: [
    { keys: 'Left-drag', action: 'Paint the highlight, or drag the copy and its handles' },
    { keys: 'Alt + click', action: 'Set the line marker' },
    { keys: 'Shift + click', action: 'Highlight a straight line from the marker' },
    { keys: 'Alt + move sideways', action: 'Change the brush size' },
    { keys: 'Enter', action: 'Clone the highlight, then Confirm the copy' },
    { keys: 'Alt + wheel', action: 'Turn the copy by 5 degrees' },
    { keys: 'Alt + Shift + wheel', action: 'Turn the copy by 1 degree' },
    { keys: 'Esc', action: 'Drop the copy, then the marker, then the highlight' },
    { keys: 'Ctrl + Z', action: 'Undo (not while a copy floats)' },
    { keys: 'Ctrl + Shift + Z', action: 'Redo' },
    { keys: 'Right-drag', action: 'Rotate the view' },
    { keys: 'Scroll', action: 'Zoom' },
  ],
};
