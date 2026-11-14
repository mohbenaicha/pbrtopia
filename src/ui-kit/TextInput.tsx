import { useId } from 'react';
import { describedBy, FieldMessage } from './FieldMessage';
import { Tooltip } from './Tooltip';
import './TextInput.css';

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password';
  placeholder?: string;
  hint?: string; // shown under the field; replaced by `error` when there is one
  tip?: string; // what the field is for, as the sentence of the label's tooltip (the hint is its fallback)
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  onBlur?: () => void; // when focus leaves the field, e.g. to tidy what was typed
}

export function TextInput({ label, value, onChange, type = 'text', placeholder, hint, tip, error, disabled = false, readOnly = false, onBlur }: TextInputProps): React.JSX.Element {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className="ui-field">
      <Tooltip heading={label} text={tip ?? hint ?? ''}><label className="ui-field__label" htmlFor={id}>{label}</label></Tooltip>
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
        onBlur={onBlur}
      />
      <FieldMessage id={messageId} hint={hint} error={error} />
    </div>
  );
}
