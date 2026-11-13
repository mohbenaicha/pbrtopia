import { useEffect, useMemo, useRef, useState } from 'react';
import { Toggle } from '@shared/ui-kit';
import { ControlRow, ToolPanel, measureEdgeDistances, seamDepthOf, shapeSeamProfile, type EdgeDistances, type EditControl, type PixelImage, type SeamParams } from '@mat/imageops';
import { useToolApply, type ToolOutcome } from './useToolApply';

interface SeamPanelProps {
  onChange(params: SeamParams): void; // R67: when the panel opens and on every change
  readEdgeSource(): Promise<PixelImage | null>; // the picture the edges are found in, read when Canny is first switched on (R66)
  onApply(params: SeamParams): Promise<ToolOutcome>;
  onClose(): void;
}

const FADE_START: EditControl = { id: 'seamFadeStart', label: 'Fade start', category: 'structure', kind: 'slider', min: 5, max: 95, step: 5, defaultValue: 55 };
const UNREADABLE_MESSAGE = 'The map to find edges in cannot be read.';

const percentOf = (depth: number): string => String(Number((depth * 100).toFixed(1)));

/**
 * Imageops R63, R65, R66: the Blend edges settings. The slider moves a uniform of the viewport (O(1)); with Canny on, the edges are measured once, on the first switch
 * to it, and the slider only re-shapes the 2N-float profile of the viewport from the measured distances. Nothing but those distances is held.
 */
export function SeamPanel({ onChange, readEdgeSource, onApply, onClose }: SeamPanelProps): React.JSX.Element {
  const [fade, setFade] = useState(FADE_START.defaultValue);
  const [canny, setCanny] = useState(false);
  const [distances, setDistances] = useState<EdgeDistances | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const { applying, error, apply } = useToolApply(onApply, onClose);
  const [reported, setReported] = useState(FADE_START.defaultValue); // R77: the Fade start the viewport and Apply use; follows `fade` on release
  const held = useRef(false); // a pointer is down on the Fade start row
  const fadeNow = useRef(fade);
  fadeNow.current = fade;
  const changeFade = (value: number): void => {
    setFade(value);
    if (!held.current) setReported(value);
  };
  const releaseFade = (): void => {
    held.current = false;
    setReported(fadeNow.current);
  };
  const holdFade = (): void => {
    held.current = true;
    for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, releaseFade, { once: true }); // the release can be anywhere on the page
  };
  const shownDepth = seamDepthOf(fade);
  const depth = seamDepthOf(reported);
  const profile = useMemo(() => (canny && distances !== null ? shapeSeamProfile(distances, depth) : null), [canny, distances, depth]);
  const report = useRef(onChange);
  report.current = onChange;
  useEffect(() => report.current({ depth, profile }), [depth, profile]);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const toggleCanny = async (): Promise<void> => {
    setReadError(null);
    if (canny) return setCanny(false);
    if (distances !== null) return setCanny(true);
    setReading(true);
    try {
      const image = await readEdgeSource();
      if (!alive.current) return;
      if (image === null) setReadError(UNREADABLE_MESSAGE);
      else { setDistances(measureEdgeDistances(image)); setCanny(true); }
    } catch {
      if (alive.current) setReadError(UNREADABLE_MESSAGE);
    } finally {
      if (alive.current) setReading(false);
    }
  };

  return (
    <ToolPanel
      title="Blend edges"
      canApply
      applying={applying}
      error={error ?? readError}
      onReset={() => { setFade(FADE_START.defaultValue); setReported(FADE_START.defaultValue); setCanny(false); setReadError(null); }}
      onCancel={onClose}
      onApply={() => void apply({ depth, profile })}
    >
      <div onPointerDown={holdFade}>
        <ControlRow control={FADE_START} value={fade} onChange={changeFade} />
      </div>
      <Toggle label="Canny edges" checked={canny} disabled={reading || applying} onChange={() => void toggleCanny()} />
      <p className="tool-panel__readout">{canny ? `Fade up to ${percentOf(shownDepth)} % of the side, ending at the first edge` : `Fade ${percentOf(shownDepth)} % of the side`}</p>
    </ToolPanel>
  );
}
