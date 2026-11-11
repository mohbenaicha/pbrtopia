import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { DIVIDER_START, dividerPercentAt, stepDivider } from './compareDivider';
import { FITTED_IMAGE_VIEW, panImageBy, zoomImageAt, type ImageView, type PixelSize } from './imageView';
import { Spinner } from './Spinner';
import './CompareViewer.css';

export interface CompareSource {
  id: string;
  label: string;
  src: string | null; // null while the picture is being read
  failed?: boolean; // the picture could not be read
}

export interface CompareStageProps {
  sources: CompareSource[]; // one or more; the first is shown on the left, the second on the right
  details?: string[];
}

function Side({ source, side }: { source: CompareSource | undefined; side: 'left' | 'right' }): React.JSX.Element | null {
  if (source === undefined || source.src !== null) return null;
  return (
    <span className={`ui-compare-viewer__state ui-compare-viewer__state--${side}`}>
      {source.failed ? 'Preview unavailable' : <Spinner label={`Loading ${source.label}`} />}
    </span>
  );
}

// Materialgen-prep S5: two pictures of one area on either side of a draggable divider, with one shared zoom and pan. The parent sets
// `--compare-frame-height` to size the frame; the filter and AO dialogs draw this as their reveal.
export function CompareStage({ sources, details = [] }: CompareStageProps): React.JSX.Element {
  const area = useRef<HTMLDivElement>(null);
  const leftPicture = useRef<HTMLImageElement>(null);
  const dragging = useRef(false);
  const [divider, setDivider] = useState(DIVIDER_START);
  const [view, setView] = useState<ImageView>(FITTED_IMAGE_VIEW);
  const [shape, setShape] = useState<PixelSize | null>(null); // the left picture's pixel size: the display rectangle takes its aspect

  const left = sources[0];
  const right = sources[1];

  // What the zoom maths needs, read when a wheel turns or a drag moves (a picture that has no size yet cannot be zoomed).
  const measure = (): { image: PixelSize; frame: PixelSize; rect: DOMRect } | null => {
    const element = area.current;
    const picture = leftPicture.current;
    if (!element || !picture || picture.naturalWidth === 0) return null;
    const rect = element.getBoundingClientRect();
    return { image: { width: picture.naturalWidth, height: picture.naturalHeight }, frame: { width: rect.width, height: rect.height }, rect };
  };

  useEffect(() => {
    const element = area.current;
    if (!element) return undefined;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault(); // the page behind never scrolls, and the wheel is this viewer's
      const sizes = measure();
      if (sizes === null) return;
      const pointer = { x: event.clientX - sizes.rect.left - sizes.rect.width / 2, y: event.clientY - sizes.rect.top - sizes.rect.height / 2 };
      setView((current) => zoomImageAt(current, event.deltaY, event.deltaMode, pointer, sizes.image, sizes.frame));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  const startPan = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.preventDefault(); // no text or picture selection while dragging
    const start = { x: event.clientX, y: event.clientY, view };
    const move = (next: MouseEvent): void => {
      const sizes = measure();
      if (sizes !== null) setView(panImageBy(start.view, next.clientX - start.x, next.clientY - start.y, sizes.image, sizes.frame));
    };
    const stop = (): void => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', stop);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', stop);
  };

  const moveDividerTo = (clientX: number): void => {
    const rect = area.current?.getBoundingClientRect();
    if (rect) setDivider(dividerPercentAt(clientX, rect));
  };
  const startDividerDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    dragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveDividerKey = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const next = stepDivider(divider, event.key, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    setDivider(next);
  };

  const transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
  const areaStyle: CSSProperties | undefined = shape === null ? undefined : { aspectRatio: `${shape.width} / ${shape.height}`, '--compare-ratio': shape.width / shape.height } as CSSProperties;
  const picture = (source: CompareSource | undefined, isLeft: boolean): React.JSX.Element | null =>
    source === undefined || source.src === null ? null : (
      <img
        className="ui-compare-viewer__picture"
        ref={isLeft ? leftPicture : undefined}
        src={source.src}
        alt={source.label}
        draggable={false}
        style={{ transform }}
        onLoad={isLeft ? (event) => setShape({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }) : undefined}
      />
    );

  return (
    <div className="ui-compare-stage">
      <div className="ui-compare-viewer__frame">
        <div className="ui-compare-viewer__area" ref={area} data-testid="compare-viewer-area" style={areaStyle} data-zoomed={view.zoom > 1 ? '' : undefined} onMouseDown={startPan} onDoubleClick={() => setView(FITTED_IMAGE_VIEW)}>
          <div className="ui-compare-viewer__layer">{picture(left, true)}</div>
          {right !== undefined && <div className="ui-compare-viewer__layer" style={{ clipPath: `inset(0 0 0 ${divider}%)` }}>{picture(right, false)}</div>}
          <Side source={left} side="left" />
          {right !== undefined && <Side source={right} side="right" />}
          {right !== undefined && (
            <div
              className="ui-compare-viewer__divider"
              role="slider"
              tabIndex={0}
              aria-label="Comparison divider"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(divider)}
              style={{ left: `${divider}%` }}
              onMouseDown={(event) => event.stopPropagation()} // a divider drag is not a pan
              onDoubleClick={(event) => event.stopPropagation()}
              onPointerDown={startDividerDrag}
              onPointerMove={(event) => { if (dragging.current) moveDividerTo(event.clientX); }}
              onPointerUp={() => { dragging.current = false; }}
              onPointerCancel={() => { dragging.current = false; }}
              onKeyDown={moveDividerKey}
            >
              <span className="ui-compare-viewer__handle" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
      {details.length > 0 && (
        <div className="ui-compare-viewer__details">
          {details.map((line) => <span key={line}>{line}</span>)}
        </div>
      )}
    </div>
  );
}
