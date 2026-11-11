import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { PanelSide } from './panelWidths';
import './PanelGutter.css';

const KEY_STEP_PX = 16;

interface PanelGutterProps {
  side: PanelSide;
  widthPx: number; // the width of the panel this gutter belongs to
  limits: { min: number; max: number };
  onResize: (widthPx: number) => void; // live, while dragging or after a key
  onCommit: () => void; // the move is over: save it
  onReset: () => void; // double click: back to the default width
}

// The strip between a side panel and the viewport; dragging it or pressing the arrow keys while it has focus resizes that panel (viewport-layout R25).
export function PanelGutter({ side, widthPx, limits, onResize, onCommit, onReset }: PanelGutterProps): React.JSX.Element {
  const grows = side === 'left' ? 1 : -1; // the direction of a pointer move that makes the panel wider
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    drag.current = { startX: event.clientX, startWidth: widthPx };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (drag.current === null) return;
    onResize(drag.current.startWidth + grows * (event.clientX - drag.current.startX));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (drag.current === null) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    onCommit();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const towardsViewport = event.key === 'ArrowRight' ? 1 : -1; // on the left gutter this widens the panel, on the right one it narrows it
    onResize(widthPx + grows * towardsViewport * KEY_STEP_PX);
    onCommit();
  };

  return (
    <div
      className={`panel-gutter panel-gutter--${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${side} panel`}
      aria-valuenow={widthPx}
      aria-valuemin={limits.min}
      aria-valuemax={limits.max}
      tabIndex={0}
      data-testid={`gutter-${side}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
    />
  );
}
