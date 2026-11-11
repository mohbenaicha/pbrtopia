export type ShortcutScope = 'viewport' | 'editing' | 'dialogs';

export interface ShortcutEntry {
  id: string;
  keys: string;
  label: string;
  scope: ShortcutScope;
}

/** Materialgen app R46: the one shortcut table of the app. The Shortcuts section is generated from it (R44, R46a). */
export const shortcutEntries: readonly ShortcutEntry[] = [
  { id: 'rotate', keys: 'Left drag', label: 'Rotate the preview mesh', scope: 'viewport' },
  { id: 'dolly', keys: 'Wheel', label: 'Move the camera closer or further', scope: 'viewport' },
  { id: 'reset-view', keys: 'Reset view icon', label: 'Return the preview to its default pose and distance', scope: 'viewport' },
  { id: 'undo', keys: 'Ctrl+Z (Cmd+Z)', label: 'Undo the map card last edited in this session, when its Undo is enabled', scope: 'editing' },
  { id: 'close', keys: 'Esc', label: 'Close the open dialog, setup overlay or image viewer, and cancel an open filter', scope: 'dialogs' },
  { id: 'confirm', keys: 'Enter', label: "Confirm a dialog's primary button", scope: 'dialogs' },
  { id: 'setup-pick', keys: 'Space', label: 'Pick up or drop an item in the setup overlay', scope: 'dialogs' },
  { id: 'setup-move', keys: 'Arrow keys', label: 'Move the marker in the setup overlay', scope: 'dialogs' },
  { id: 'viewer-zoom', keys: 'Wheel', label: 'Zoom in the image and compare viewers', scope: 'dialogs' },
  { id: 'viewer-pan', keys: 'Drag', label: 'Pan in the image and compare viewers', scope: 'dialogs' },
  { id: 'viewer-fit', keys: 'Double-click', label: 'Fit the picture to the viewer', scope: 'dialogs' },
];
