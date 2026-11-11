import { useState } from 'react';
import { Icon, IconButton, Slider, Toggle } from '@shared/ui-kit';
import { clampControlValue, type EditControl } from '../filters/editControls';

interface ControlRowProps {
  control: EditControl;
  value: number;
  onChange: (value: number) => void;
}

const decimalsOf = (step: number): number => (step >= 1 ? 0 : Math.ceil(-Math.log10(step)));
const roundTo = (value: number, step: number): number => Number(value.toFixed(decimalsOf(step)));

/** Imageops R17: one control as a slider with a number input and a reset-to-default arrow, or a switch for a toggle. */
export function ControlRow({ control, value, onChange }: ControlRowProps): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null); // what is typed in the number input until it is committed
  if (control.kind === 'toggle') return <Toggle label={control.label} checked={value !== 0} onChange={(checked) => onChange(checked ? 1 : 0)} />;

  const commit = (): void => {
    if (draft === null) return;
    setDraft(null);
    onChange(clampControlValue(control, draft.trim() === '' ? Number.NaN : Number(draft)));
  };
  const readout = (
    <span className="op-control__readout">
      <input
        className="op-control__number"
        type="number"
        aria-label={`${control.label} value`}
        min={control.min}
        max={control.max}
        step={control.step}
        value={draft ?? roundTo(value, control.step)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') commit(); }}
      />
      <IconButton
        label={`Reset ${control.label}`}
        icon={<Icon name="reset" />}
        compact
        disabled={value === control.defaultValue}
        onClick={() => onChange(control.defaultValue)}
      />
    </span>
  );
  return <Slider layout="row" label={control.label} value={value} min={control.min} max={control.max} step={control.step} onChange={(next) => onChange(clampControlValue(control, next))} readout={readout} />;
}
