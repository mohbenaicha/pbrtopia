import type { ReactNode } from 'react';
import { Tabs, type TabOption } from '../ui-kit';
import './LeftPanel.css';

interface LeftPanelProps<Tab extends string> {
  label: string; // the accessible name of the tab strip
  tabs: TabOption<Tab>[];
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  content: Record<Tab, ReactNode>; // only the chosen tab's content is drawn
}

// The left column: a tab strip and the body of the chosen tab (viewport-layout R5).
export function LeftPanel<Tab extends string>({ label, tabs, tab, onTabChange, content }: LeftPanelProps<Tab>): React.JSX.Element {
  return (
    <aside className="left-panel" data-testid="left-panel">
      <div className="left-panel__tabs">
        <Tabs label={label} tabs={tabs} value={tab} onChange={onTabChange} />
      </div>
      <div className="left-panel__body" role="tabpanel">
        {content[tab]}
      </div>
    </aside>
  );
}
