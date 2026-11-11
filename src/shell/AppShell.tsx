import type { CSSProperties, ReactNode } from 'react';
import { PanelGutter } from './PanelGutter';
import type { usePanelWidths } from './usePanelWidths';
import './AppShell.css';

interface AppShellProps {
  topBar: ReactNode;
  left: ReactNode;
  viewport: ReactNode;
  right: ReactNode;
  locked?: boolean; // the custom setup overlay or the mesh edit mode is open (custom R30, mesh edit R2): the top bar and the left panel cannot be used; the right panel decides for itself what stays live
  rightLocked?: boolean; // the mesh edit mode is open: the right panel cannot be used either
  panels: Pick<ReturnType<typeof usePanelWidths>, 'widths' | 'resize' | 'commit' | 'reset' | 'limits'>;
}

// The window frame: a top bar, a left panel, the viewport and a right panel, with a draggable gutter beside each side panel (specs/app/viewport-layout architecture, Shell).
export function AppShell({ topBar, left, viewport, right, locked = false, rightLocked = false, panels }: AppShellProps): React.JSX.Element {
  const style = { '--panel-left': `${panels.widths.left}px`, '--panel-right': `${panels.widths.right}px` } as CSSProperties;
  return (
    <div className="app-shell" data-testid="app-shell" style={style}>
      <div className="app-shell__top" data-testid="shell-top" inert={locked}>
        {topBar}
      </div>
      <div className="app-shell__left" data-testid="shell-left" inert={locked}>
        {left}
      </div>
      <main className="app-shell__viewport" data-testid="shell-viewport">
        {viewport}
      </main>
      <div className="app-shell__right" data-testid="shell-right" inert={rightLocked}>
        {right}
      </div>
      {(['left', 'right'] as const).map((side) => (
        <PanelGutter
          key={side}
          side={side}
          widthPx={panels.widths[side]}
          limits={panels.limits(side)}
          onResize={(px) => panels.resize(side, px)}
          onCommit={panels.commit}
          onReset={() => panels.reset(side)}
        />
      ))}
    </div>
  );
}
