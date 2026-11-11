import { ShortcutsSection, type ShortcutGroup } from '@shared/shell';
import { shortcutEntries, type ShortcutEntry, type ShortcutScope } from './shortcutMap';

const GROUPS: { heading: string; scope: ShortcutScope }[] = [
  { heading: 'Viewport', scope: 'viewport' },
  { heading: 'Editing', scope: 'editing' },
  { heading: 'Dialogs and overlays', scope: 'dialogs' },
];

/** Materialgen app R44: the shortcut table as the three groups of the Shortcuts section, always in this order; a group with no entries is kept, empty. */
export function groupShortcuts(entries: readonly ShortcutEntry[]): ShortcutGroup[] {
  return GROUPS.map(({ heading, scope }) => ({ heading, entries: entries.filter((entry) => entry.scope === scope) }));
}

/** Materialgen app R44, R46a: every shortcut of the app, generated from its one table. */
export function MaterialShortcutsSection({ entries = shortcutEntries }: { entries?: readonly ShortcutEntry[] }): React.JSX.Element {
  return <ShortcutsSection groups={groupShortcuts(entries)} />;
}
