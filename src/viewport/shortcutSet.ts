/** App/shortcuts R2: what the Shortcuts panel draws. The owner of a viewport picks the set; the panel knows no tool. */
export interface ShortcutEntry {
  keys: string; // plain text, e.g. "Alt + click"
  action: string;
}

export interface ShortcutSet {
  id: string;
  entries: readonly ShortcutEntry[];
}

/** The camera gestures of the shared viewport (viewport-layout R16): what shows when no tool has its own set. */
export const ORBIT_SHORTCUTS: ShortcutSet = {
  id: 'orbit',
  entries: [
    { keys: 'Right-drag', action: 'Orbit' },
    { keys: 'Middle-drag', action: 'Pan' },
    { keys: 'Scroll', action: 'Zoom' },
  ],
};
