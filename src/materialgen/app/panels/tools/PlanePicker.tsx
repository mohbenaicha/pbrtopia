import { useEffect, useRef, useState } from 'react';
import { QUADRANTS, type CropEdge, type Quadrant } from '@mat/imageops';
import { useViewAngle } from './ViewAngleContext';
import './planePicker.css';

type PlanePickerProps =
  | { handles: 'edges'; edgeTitle(edge: CropEdge): string; onEdge(edge: CropEdge): void; onEdgeMark(edge: CropEdge | null): void }
  | { handles: 'corners'; selected: ReadonlySet<Quadrant>; onCorner(quadrant: Quadrant): void };

const EDGES: ReadonlyArray<{ edge: CropEdge; label: string }> = [
  { edge: 'top', label: 'Top' },
  { edge: 'left', label: 'Left' },
  { edge: 'right', label: 'Right' },
  { edge: 'bottom', label: 'Bottom' },
];
const CORNER_TITLE: Record<Quadrant, string> = { TL: 'Top left', TR: 'Top right', BL: 'Bottom left', BR: 'Bottom right' };
const TILT_DEGREES = 40; // the picker's own tilt; the camera's pitch is not followed (R72)
const FLASH_MS = 200; // R71: how long an edge handle stays gold after a click

/**
 * Imageops R71-R74: a small plane in place of the direction buttons and checkboxes. It carries one set of handles, the four edges (Crop: a click is a trim, so the
 * handle only flashes gold) or the four corners (Mirror: a click is a toggle, so a selected corner stays gold). The plane is turned by the view's angle (R72).
 */
export function PlanePicker(props: PlanePickerProps): React.JSX.Element {
  const angle = useViewAngle();
  return (
    <div className="plane-picker">
      <div className="plane-picker__plane" data-testid="plane-picker-plane" style={{ transform: `rotateX(${TILT_DEGREES}deg) rotateZ(${angle}deg)` }}>
        {props.handles === 'edges' ? <EdgeHandles {...props} /> : <CornerHandles {...props} />}
      </div>
    </div>
  );
}

function EdgeHandles({ edgeTitle, onEdge, onEdgeMark }: Extract<PlanePickerProps, { handles: 'edges' }>): React.JSX.Element {
  const [flash, setFlash] = useState<CropEdge | null>(null);
  const [down, setDown] = useState<CropEdge | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const click = (edge: CropEdge): void => {
    onEdge(edge);
    setFlash(edge);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFlash(null), FLASH_MS);
  };
  const release = (): void => setDown(null);
  return (
    <>
      {EDGES.map(({ edge, label }) => (
        <button
          key={edge}
          type="button"
          className="plane-picker__edge"
          data-edge={edge}
          data-active={String(flash === edge || down === edge)}
          aria-label={label}
          title={edgeTitle(edge)}
          onClick={() => click(edge)}
          onPointerDown={() => setDown(edge)}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
          onMouseEnter={() => onEdgeMark(edge)}
          onMouseLeave={() => onEdgeMark(null)}
          onFocus={() => onEdgeMark(edge)}
          onBlur={() => onEdgeMark(null)}
        />
      ))}
    </>
  );
}

function CornerHandles({ selected, onCorner }: Extract<PlanePickerProps, { handles: 'corners' }>): React.JSX.Element {
  return (
    <>
      {QUADRANTS.map((quadrant) => (
        <span key={`tint-${quadrant}`} className="plane-picker__quadrant" data-quadrant={quadrant} data-selected={String(selected.has(quadrant))} aria-hidden="true" />
      ))}
      {QUADRANTS.map((quadrant) => (
        <button
          key={quadrant}
          type="button"
          className="plane-picker__corner"
          data-corner={quadrant}
          data-active={String(selected.has(quadrant))}
          aria-label={quadrant}
          aria-pressed={selected.has(quadrant)}
          title={CORNER_TITLE[quadrant]}
          onClick={() => onCorner(quadrant)}
        />
      ))}
    </>
  );
}
