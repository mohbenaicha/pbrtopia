import './Checkbox.css';

interface CheckboxProps {
  label: string; // the accessible name; drawn beside the box unless hideLabel is set
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hideLabel?: boolean; // for a box repeated in a list, where the row already shows the name
}

// A tick box. The real checkbox stays in place so the keyboard and screen readers work.
export function Checkbox({ label, checked, onChange, disabled = false, hideLabel = false }: CheckboxProps): React.JSX.Element {
  return (
    <label className="ui-checkbox" data-disabled={disabled ? '' : undefined}>
      <input type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="ui-checkbox__box" aria-hidden="true" />
      {!hideLabel && <span className="ui-checkbox__label">{label}</span>}
    </label>
  );
}
