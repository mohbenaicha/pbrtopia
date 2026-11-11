import { useEffect, useRef, useState } from 'react';
import { Checkbox, SegmentedControl } from '@shared/ui-kit';
import { QUADRANTS, ToolPanel, availableMirrorModes, planMirror, toggleQuadrant, type MirrorMode, type MirrorPlan, type Quadrant } from '@mat/imageops';
import { useToolApply, type ToolOutcome } from './useToolApply';

interface MirrorPanelProps {
  onChange(plan: MirrorPlan | null, selection: ReadonlySet<Quadrant>): void; // R56: when the panel opens and on every change
  onApply(plan: MirrorPlan): Promise<ToolOutcome>;
  onClose(): void;
}

const MODES: ReadonlyArray<{ value: MirrorMode; label: string }> = [
  { value: 'pair', label: 'Pair' },
  { value: 'x', label: 'X' },
  { value: 'y', label: 'Y' },
  { value: 'around', label: 'Around' },
];
const START: ReadonlySet<Quadrant> = new Set<Quadrant>(['TL', 'TR']);

/**
 * Imageops R32, R56, R57: which quadrants to mirror and how. The viewport shows the result and draws a line on the outer edges of the quadrants the
 * mirror copies from. The selection is always a corner or a half (toggleQuadrant), so a mode always fits; each mode is offered only when it fits.
 */
export function MirrorPanel({ onChange, onApply, onClose }: MirrorPanelProps): React.JSX.Element {
  const [selection, setSelection] = useState<ReadonlySet<Quadrant>>(START);
  const [chosen, setChosen] = useState<MirrorMode>('pair');
  const available = availableMirrorModes(selection);
  const mode = available.includes(chosen) ? chosen : available[0]; // when the chosen mode stops fitting, the first one that does is used
  const plan = mode === undefined ? null : planMirror(mode, selection);
  const { applying, error, apply } = useToolApply(onApply, onClose);
  const report = useRef(onChange);
  report.current = onChange;
  const planRef = useRef(plan);
  planRef.current = plan;
  useEffect(() => report.current(planRef.current, selection), [mode, selection]); // `plan` is derived from the mode and the selection
  const toggle = (quadrant: Quadrant): void => setSelection(toggleQuadrant(selection, quadrant)); // R32: a corner or a half, never empty

  return (
    <ToolPanel
      title="Mirror"
      canApply={plan !== null}
      applying={applying}
      error={error}
      onReset={() => { setSelection(START); setChosen('pair'); }}
      onCancel={onClose}
      onApply={() => { if (plan !== null) void apply(plan); }}
    >
      <div className="mirror-grid" role="group" aria-label="Quadrants to mirror">
        {QUADRANTS.map((quadrant) => (
          <Checkbox key={quadrant} label={quadrant} checked={selection.has(quadrant)} onChange={() => toggle(quadrant)} />
        ))}
      </div>
      <SegmentedControl
        label="Mirror mode"
        options={MODES.map(({ value, label }) => ({ value, label, disabled: !available.includes(value) }))}
        value={mode ?? chosen}
        onChange={setChosen}
      />
    </ToolPanel>
  );
}
