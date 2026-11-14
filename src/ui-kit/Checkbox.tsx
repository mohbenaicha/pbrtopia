import { Tooltip } from './Tooltip';
import './Checkbox.css';

interface CheckboxProps {
  label: string; // the accessible name; drawn beside the box unless hideLabel is set
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hideLabel?: boolean; // for a box repeated in a list, where the row already shows the name
  hint?: string; // what ticking it does: the sentence of the tooltip, under the label as its heading
}

// A tick box. The real checkbox stays in place so the keyboard and screen readers work.
export function Checkbox({ label, checked, onChange, disabled = false, hideLabel = false, hint = '' }: CheckboxProps): React.JSX.Element {
  return (
    <Tooltip heading={label} text={hint}>
      <label className="ui-checkbox" data-disabled={disabled ? '' : undefined}>
        <input type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span className="ui-checkbox__box" aria-hidden="true" />
        {!hideLabel && <span className="ui-checkbox__label">{label}</span>}
      </label>
    </Tooltip>
  );
}
