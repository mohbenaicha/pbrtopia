import { useId } from 'react';
import { describedBy, FieldMessage } from './FieldMessage';
import './TextInput.css';

export interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password';
  placeholder?: string;
  hint?: string; // shown under the field; replaced by `error` when there is one
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

export function TextInput({ label, value, onChange, type = 'text', placeholder, hint, error, disabled = false, readOnly = false }: TextInputProps): React.JSX.Element {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className="ui-field">
      <label className="ui-field__label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="ui-text-input"
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(messageId, hint, error)}
        data-error={error ? '' : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldMessage id={messageId} hint={hint} error={error} />
    </div>
  );
}
