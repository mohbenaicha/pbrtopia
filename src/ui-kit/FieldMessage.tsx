import './FieldMessage.css';

interface FieldMessageProps {
  id: string;
  hint?: string | undefined;
  error?: string | undefined;
}

// The line under a field: the error if there is one, otherwise the hint, otherwise nothing. Shared by every field control.
export function FieldMessage({ id, hint, error }: FieldMessageProps): React.JSX.Element | null {
  if (error) return <p id={id} className="ui-field-message" data-error="" role="alert">{error}</p>;
  if (hint) return <p id={id} className="ui-field-message">{hint}</p>;
  return null;
}

// The id a field should point aria-describedby at, or undefined when it has no message.
export function describedBy(id: string, hint?: string | undefined, error?: string | undefined): string | undefined {
  return error || hint ? id : undefined;
}
