import './Spinner.css';

// A busy indicator. Inside a control (a loading button) it is decorative; on its own it is a status with a label.
export function Spinner({ label, decorative = false }: { label?: string; decorative?: boolean }): React.JSX.Element {
  if (decorative) return <span className="ui-spinner" aria-hidden="true" />;
  return <span className="ui-spinner" role="status" aria-label={label ?? 'Loading'} />;
}
