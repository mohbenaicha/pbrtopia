import { SettingsGroup } from './SettingsGroup';
import { SettingsPage } from './SettingsPage';

export interface ShortcutRow {
  id: string;
  keys: string;
  label: string;
}

export interface ShortcutGroup {
  heading: string;
  entries: readonly ShortcutRow[];
}

// Settings R9: every keyboard and drag shortcut, read-only, in the groups the app gives; the app generates the groups from its one shortcut table.
export function ShortcutsSection({ groups }: { groups: readonly ShortcutGroup[] }): React.JSX.Element {
  return (
    <SettingsPage title="Shortcuts" description="Every keyboard and mouse shortcut. This list only shows them; it cannot change them.">
      {groups.map((group) => (
        <SettingsGroup key={group.heading} title={group.heading}>
          <ul className="shortcut-list">
            {group.entries.map((entry) => (
              <li key={entry.id} className="shortcut-row">
                <kbd className="shortcut-row__keys">{entry.keys}</kbd>
                <span>{entry.label}</span>
              </li>
            ))}
          </ul>
        </SettingsGroup>
      ))}
    </SettingsPage>
  );
}
