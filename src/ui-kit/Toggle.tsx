import './Toggle.css';

interface ToggleProps {
  label: string; // shown beside the switch and used as its accessible name
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string | undefined; // tooltip, e.g. why the switch is unavailable
  dense?: boolean; // a row as tall as a slider row, for a panel of many controls (compositing R45)
}

// An on/off switch. The whole row is clickable; the real checkbox stays in place so the keyboard and screen readers work.
export function Toggle({ label, checked, onChange, disabled = false, hint, dense = false }: ToggleProps): React.JSX.Element {
  return (
    <label className="ui-toggle" data-disabled={disabled ? '' : undefined} data-dense={dense ? '' : undefined} title={hint}>
      <span className="ui-toggle__label">{label}</span>
      <input type="checkbox" role="switch" aria-label={label} aria-checked={checked} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="ui-toggle__track" aria-hidden="true" />
    </label>
  );
}
