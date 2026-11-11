import { Fragment, useId, useRef, useState, type KeyboardEvent } from 'react';
import { describedBy, FieldMessage } from './FieldMessage';
import { Icon } from './Icon';
import { useDismiss } from './useDismiss';
import './Select.css';

export interface SelectOption {
  value: string;
  label: string;
  group?: string; // a heading drawn above the first option of each run of options with the same group
  detail?: string; // drawn after the label in the list, not in the closed box (a value, a unit)
  hint?: string; // a tooltip on the option in the list, saying what it is about
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
  opensUp?: boolean; // the list opens above the box, for a select near the bottom of a panel where a list below would cover the controls under it
  searchable?: boolean; // the list opens with a filter box; typing keeps the options whose label holds the text (case-insensitive)
  noMatchText?: string; // shown in the list when the filter keeps nothing
  title?: string; // a tooltip on the box
}

// A dropdown that draws its own list so it matches the rest of the UI. Focus stays on the box; the list is driven by the keyboard or the mouse.
export function Select({
  label, options, value, onChange, disabled = false, emptyText = 'Nothing to choose', error, hideLabel = false, opensUp = false, searchable = false, noMatchText = 'No matches', title,
}: SelectProps): React.JSX.Element {
  const id = useId();
  const region = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [query, setQuery] = useState('');
  const empty = options.length === 0;
  const inactive = disabled || empty;
  const selected = options.find((option) => option.value === value);
  const needle = query.trim().toLowerCase();
  const shown = searchable && needle !== '' ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;

  useDismiss(open, region, () => setOpen(false));

  const openList = (): void => {
    setQuery('');
    setHighlighted(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };
  const choose = (index: number): void => {
    const option = shown[index];
    if (option) onChange(option.value);
    setOpen(false);
  };
  const move = (delta: number): void => setHighlighted((index) => Math.min(shown.length - 1, Math.max(0, index + delta)));

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (inactive) return;
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

  // The focus is in the filter box while a searchable list is open; it takes the keys the box takes, and Escape puts the focus back on the box.
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(highlighted);
    } else if (event.key === 'Escape') {
      box.current?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const list = (
    <ul className="ui-select__list" data-opens-up={opensUp && !searchable ? '' : undefined} role="listbox" id={`${id}-list`} aria-labelledby={`${id}-label`}>
      {shown.map((option, index) => (
        <Fragment key={option.value}>
          {option.group !== undefined && option.group !== shown[index - 1]?.group && <li role="presentation" className="ui-select__heading">{option.group}</li>}
          <li
            id={`${id}-option-${index}`}
            role="option"
            aria-selected={option.value === value}
            title={option.hint}
            className="ui-select__option"
            data-highlighted={index === highlighted ? '' : undefined}
            onPointerEnter={() => setHighlighted(index)}
            onClick={() => choose(index)}
          >
            <span className="ui-select__option-label">{option.label}</span>
            {option.detail !== undefined && <span className="ui-select__option-detail">{option.detail}</span>}
          </li>
        </Fragment>
      ))}
    </ul>
  );

  return (
    <div className="ui-field" ref={region}>
      <span className="ui-field__label" id={`${id}-label`} data-hidden={hideLabel ? '' : undefined}>{label}</span>
      <div className="ui-select">
        <button
          ref={box}
          type="button"
          role="combobox"
          title={title}
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
        {open && !searchable && list}
        {open && searchable && (
          <div className="ui-select__popup" data-opens-up={opensUp ? '' : undefined}>
            <input
              className="ui-select__search"
              type="search"
              role="searchbox"
              aria-label={`Filter ${label}`}
              aria-controls={`${id}-list`}
              aria-activedescendant={shown.length > 0 ? `${id}-option-${highlighted}` : undefined}
              autoComplete="off"
              autoFocus
              value={query}
              onChange={(event) => { setQuery(event.target.value); setHighlighted(0); }}
              onKeyDown={onSearchKeyDown}
            />
            {shown.length === 0 ? <p className="ui-select__no-match" role="status">{noMatchText}</p> : list}
          </div>
        )}
      </div>
      <FieldMessage id={`${id}-message`} error={error} />
    </div>
  );
}
