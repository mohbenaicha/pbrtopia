import type { ReactNode } from 'react';
import './RightPanel.css';

// The right-hand column; it holds the Generate panel (R9).
export function RightPanel({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <aside className="right-panel" data-testid="right-panel">
      {children}
    </aside>
  );
}
