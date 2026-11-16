import { Tooltip } from './Tooltip';
import './Toggle.css';

interface ToggleProps {
  label: string; // shown beside the switch and used as its accessible name
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string | undefined; // the tooltip's text under the label as its heading: what the switch does, or why it is unavailable
  dense?: boolean; // a row as tall as a slider row, for a panel of many controls (compositing R45)
  tutorial?: string; // the guided tour's anchor
}

// An on/off switch. The whole row is clickable; the real checkbox stays in place so the keyboard and screen readers work.
export function Toggle({ label, checked, onChange, disabled = false, hint, dense = false, tutorial }: ToggleProps): React.JSX.Element {
  const row = (
    <label className="ui-toggle" data-tutorial={tutorial} data-disabled={disabled ? '' : undefined} data-dense={dense ? '' : undefined}>
      <span className="ui-toggle__label">{label}</span>
      <input type="checkbox" role="switch" aria-label={label} aria-checked={checked} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="ui-toggle__track" aria-hidden="true" />
    </label>
  );
  // Every switch has a tooltip (app tooltips R1); the whole row is the hover target, so a disabled switch still says why.
  return <Tooltip heading={label} text={hint ?? ''}>{row}</Tooltip>;
}
