import type { ReactNode } from 'react';
import './LeftPanel.css';

// The left column for an app whose left panel is one page: the body of `LeftPanel` without a tab strip (materialgen-prep R66).
export function PlainLeftPanel({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <aside className="left-panel" data-testid="left-panel">
      <div className="left-panel__body">{children}</div>
    </aside>
  );
}
