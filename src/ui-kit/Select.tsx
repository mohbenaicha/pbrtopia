import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { describedBy, FieldMessage } from './FieldMessage';
import { Icon } from './Icon';
import { useDismiss } from './useDismiss';
import './Select.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  emptyText?: string; // shown, with the select disabled, when there are no options
  error?: string;
  hideLabel?: boolean; // the label stays the accessible name but is not drawn, for a select under a heading that already says it
}

// A dropdown that draws its own list so it matches the rest of the UI. Focus stays on the box; the list is driven by the keyboard or the mouse.
export function Select({ label, options, value, onChange, disabled = false, emptyText = 'Nothing to choose', error, hideLabel = false }: SelectProps): React.JSX.Element {
  const id = useId();
  const region = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const empty = options.length === 0;
  const inactive = disabled || empty;
  const selected = options.find((option) => option.value === value);

  useDismiss(open, region, () => setOpen(false));

  const openList = (): void => {
    setHighlighted(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };
  const choose = (index: number): void => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (inactive) return;
    const move = (delta: number): void => setHighlighted((index) => Math.min(options.length - 1, Math.max(0, index + delta)));
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) openList();
      else move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(highlighted);
      else openList();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className="ui-field" ref={region}>
      <span className="ui-field__label" id={`${id}-label`} data-hidden={hideLabel ? '' : undefined}>{label}</span>
      <div className="ui-select">
        <button
          type="button"
          role="combobox"
          className="ui-select__box"
          aria-labelledby={`${id}-label`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? `${id}-list` : undefined}
          aria-activedescendant={open ? `${id}-option-${highlighted}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(`${id}-message`, undefined, error)}
          data-error={error ? '' : undefined}
          disabled={inactive}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={onKeyDown}
          onKeyUp={(event) => event.key === ' ' && event.preventDefault()}
        >
          <span className="ui-select__value" data-placeholder={selected ? undefined : ''}>{empty ? emptyText : (selected?.label ?? '')}</span>
          <Icon name="chevron-down" size={14} />
        </button>
        {open && (
          <ul className="ui-select__list" role="listbox" id={`${id}-list`} aria-labelledby={`${id}-label`}>
            {options.map((option, index) => (
              <li
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={option.value === value}
                className="ui-select__option"
                data-highlighted={index === highlighted ? '' : undefined}
                onPointerEnter={() => setHighlighted(index)}
                onClick={() => choose(index)}
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <FieldMessage id={`${id}-message`} error={error} />
    </div>
  );
}
