import { Children, cloneElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

/** Hover waits this long before the panel opens; keyboard focus opens it at once (compositing R48). */
export const TOOLTIP_DELAY_MS = 400;
const WINDOW_MARGIN_PX = 8;
const ARROW_GAP_PX = 8;
const ARROW_EDGE_PX = 14;

/* One tooltip is open at a time, so the open one is a single module-level id every Tooltip watches. */
let openId: string | null = null;
let keyboardUsed = false;
let listening = false;
const watchers = new Set<() => void>();
/** An element carrying this attribute inside a Tooltip's child never opens that tooltip by pointer (compositing R49); keyboard focus still does. */
export const TOOLTIP_SKIP_ATTRIBUTE = 'data-tooltip-skip';
const claimed = new WeakSet<Event>(); // the pointer events a Tooltip has taken: one nested in another claims first (React bubbles from the target up)

const subscribe = (watcher: () => void): (() => void) => {
  watchers.add(watcher);
  return () => void watchers.delete(watcher);
};
const readOpenId = (): string | null => openId;

function setOpenId(next: string | null): void {
  if (openId === next) return;
  openId = next;
  watchers.forEach((watcher) => watcher());
}

/** Installed once, on first use: what the user did last (key or pointer) tells a keyboard focus from a click focus, and a press, a scroll or Escape ends any open tooltip. */
function listenToTheWindow(): void {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpenId(null);
    else keyboardUsed = true;
  }, true);
  document.addEventListener('pointerdown', () => {
    keyboardUsed = false;
    setOpenId(null);
  }, true);
  window.addEventListener('scroll', () => setOpenId(null), true);
}

type Placement = { left: number; top: number; arrowX: number; side: 'above' | 'below' };

/** Below the anchor when it fits, else above; centred on the anchor and kept inside the window. */
function placePanel(anchor: DOMRect, panel: { width: number; height: number }): Placement {
  const fitsBelow = anchor.bottom + ARROW_GAP_PX + panel.height + WINDOW_MARGIN_PX <= window.innerHeight;
  const side = fitsBelow ? 'below' : 'above';
  const top = side === 'below' ? anchor.bottom + ARROW_GAP_PX : anchor.top - ARROW_GAP_PX - panel.height;
  const centre = anchor.left + anchor.width / 2;
  const widest = Math.max(WINDOW_MARGIN_PX, window.innerWidth - panel.width - WINDOW_MARGIN_PX);
  const left = Math.min(Math.max(centre - panel.width / 2, WINDOW_MARGIN_PX), widest);
  const arrowX = Math.min(Math.max(centre - left, ARROW_EDGE_PX), Math.max(ARROW_EDGE_PX, panel.width - ARROW_EDGE_PX));
  return { left, top, arrowX, side };
}

function TooltipPanel({ id, heading, text, anchor }: { id: string; heading: string; text: string; anchor: HTMLElement }): React.JSX.Element {
  const panel = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  useLayoutEffect(() => {
    const box = panel.current;
    if (box === null) return;
    setPlacement(placePanel(anchor.getBoundingClientRect(), { width: box.offsetWidth, height: box.offsetHeight }));
  }, [anchor, heading, text]);
  return createPortal(
    <div
      ref={panel}
      id={id}
      role="tooltip"
      className="ui-tooltip"
      data-side={placement?.side ?? 'below'}
      style={{ left: placement?.left ?? 0, top: placement?.top ?? 0, visibility: placement === null ? 'hidden' : 'visible', ['--tooltip-arrow-x' as string]: `${placement?.arrowX ?? 0}px` }}
    >
      <p className="ui-tooltip__heading">{heading}</p>
      {text !== '' && <p className="ui-tooltip__text">{text}</p>}
    </div>,
    document.body,
  );
}

const chain = <E,>(own: unknown, ours: (event: E) => void) => (event: E): void => {
  if (typeof own === 'function') own(event);
  ours(event);
};

interface TooltipProps {
  heading: string;
  text: string;
  /** Exactly one element that accepts the pointer, focus and key handlers (a DOM element, or a component that passes them on). */
  children: ReactElement<Record<string, unknown>>;
}

/**
 * The template for every tooltip in the app (compositing R48): dark panel, gold outline and heading, white text. It adds no element around its child: it hands the
 * child the hover and focus handlers and a description link, and draws the panel through a portal only while open.
 */
export function Tooltip({ heading, text, children }: TooltipProps): React.JSX.Element {
  const id = useId();
  const descriptionId = `${id}-description`;
  const anchor = useRef<HTMLElement | null>(null);
  const timer = useRef<number | null>(null);
  const isOpen = useSyncExternalStore(subscribe, readOpenId, readOpenId) === id;
  const child = Children.only(children);

  const stopWaiting = useCallback((): void => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const close = useCallback((): void => {
    stopWaiting();
    if (openId === id) setOpenId(null);
  }, [id, stopWaiting]);
  useEffect(() => {
    listenToTheWindow();
    return close;
  }, [close]);

  const own = child.props;
  const onPointerOver = chain<React.PointerEvent<HTMLElement>>(own.onPointerOver, (event) => {
    if (claimed.has(event.nativeEvent)) { // a tooltip inside this one's control already has the pointer: the innermost speaks
      close();
      return;
    }
    claimed.add(event.nativeEvent);
    const skipped = event.target instanceof Element ? event.target.closest(`[${TOOLTIP_SKIP_ATTRIBUTE}]`) : null;
    if (skipped !== null && event.currentTarget.contains(skipped)) { // a part that opts out, e.g. a slider's track: no tooltip while the pointer is on it
      close();
      return;
    }
    if (event.pointerType === 'touch' || timer.current !== null || openId === id) return;
    anchor.current = event.currentTarget;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setOpenId(id);
    }, TOOLTIP_DELAY_MS);
  });
  const onPointerOut = chain<React.PointerEvent<HTMLElement>>(own.onPointerOut, (event) => {
    const into = event.relatedTarget;
    if (into instanceof Node && event.currentTarget.contains(into)) return;
    close();
  });
  const onPointerDown = chain<React.PointerEvent<HTMLElement>>(own.onPointerDown, close);
  const onFocus = chain<React.FocusEvent<HTMLElement>>(own.onFocus, (event) => {
    if (!keyboardUsed) return;
    anchor.current = event.currentTarget;
    stopWaiting();
    setOpenId(id);
  });
  const onBlur = chain<React.FocusEvent<HTMLElement>>(own.onBlur, close);

  const hasText = text !== ''; // app tooltips R7: a heading-only tooltip adds no description, the control's own name already says it
  const ownDescription = typeof own['aria-describedby'] === 'string' ? own['aria-describedby'] : undefined;
  const describedBy = hasText ? (ownDescription === undefined ? descriptionId : `${ownDescription} ${descriptionId}`) : ownDescription;
  return (
    <>
      {cloneElement(child, { onPointerOver, onPointerOut, onPointerDown, onFocus, onBlur, 'aria-describedby': describedBy })}
      {hasText && <span id={descriptionId} className="ui-tooltip__description" hidden>{`${heading}. ${text}`}</span>}
      {isOpen && anchor.current !== null && <TooltipPanel id={id} heading={heading} text={text} anchor={anchor.current} />}
    </>
  );
}
