import { useState } from 'react';
import { Disclosure } from '@shared/ui-kit';
import type { ShortcutSet } from '../shortcutSet';
import './ShortcutsPanel.css';

/** App/shortcuts R1-R4: the collapsible Shortcuts panel at the viewport's bottom-left; it draws whatever set it is given. */
export function ShortcutsPanel({ set }: { set: ShortcutSet }): React.JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <div className="shortcuts-panel">
      <Disclosure title="Shortcuts" hint="The mouse and keyboard gestures of the tool that is active." open={open} onOpenChange={setOpen}>
        <ul className="shortcuts-panel__list">
          {set.entries.map((entry) => (
            <li key={entry.keys + entry.action} className="shortcuts-panel__row">
              <kbd className="shortcuts-panel__keys">{entry.keys}</kbd>
              <span className="shortcuts-panel__action">{entry.action}</span>
            </li>
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}
