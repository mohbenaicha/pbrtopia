import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createViewport, type Viewport } from '../createViewport';
import { ORBIT_SHORTCUTS, type ShortcutSet } from '../shortcutSet';
import { ShortcutsPanel } from './ShortcutsPanel';
import './ViewportCanvas.css';

interface ViewportCanvasProps {
  onReady?: (viewport: Viewport | null) => void; // the viewport once created, null when it is disposed
  overlay?: (viewport: Viewport) => ReactNode; // drawn over the canvas, e.g. the corner controls
  shortcuts?: ShortcutSet; // what the Shortcuts panel at the bottom-left lists (app/shortcuts R2); the orbit gestures by default
}

// Creates the viewport in its own container, keeps it for as long as it is shown, and puts the overlay and the Shortcuts panel over it.
export function ViewportCanvas({ onReady, overlay, shortcuts = ORBIT_SHORTCUTS }: ViewportCanvasProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const latestOnReady = useRef(onReady);
  const [viewport, setViewport] = useState<Viewport | null>(null);

  useEffect(() => {
    latestOnReady.current = onReady;
  });

  useEffect(() => {
    const created = createViewport(host.current!);
    setViewport(created);
    latestOnReady.current?.(created);
    return () => {
      latestOnReady.current?.(null);
      created.dispose();
      setViewport(null);
    };
  }, []);

  return (
    <div className="viewport-surface" data-testid="viewport">
      <div className="viewport-surface__canvas" ref={host} />
      {viewport !== null && overlay?.(viewport)}
      <ShortcutsPanel set={shortcuts} />
    </div>
  );
}
