import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import './SegmentedControl.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: string; // the full name: the accessible name, and the tooltip when a short form is shown
  short?: string; // shown in place of the label
  hoverIcon?: ReactNode; // replaces the text while the option is hovered or focused
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  label: string; // accessible name of the group
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

// One choice out of a few, always visible. Arrow keys move the choice, skipping disabled options; only the chosen one is in the tab order.
export function SegmentedControl<T extends string>({ label, options, value, onChange, disabled = false }: SegmentedControlProps<T>): React.JSX.Element {
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const choosable = options.filter((option) => !option.disabled);

  const choose = (next: T | undefined): void => {
    if (next === undefined || disabled) return;
    onChange(next);
    buttons.current.get(next)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = choosable.findIndex((option) => option.value === value);
    const step = (offset: number): T | undefined => choosable[(index + offset + choosable.length) % choosable.length]?.value;
    const target: Record<string, T | undefined> = {
      ArrowRight: step(1),
      ArrowDown: step(1),
      ArrowLeft: step(-1),
      ArrowUp: step(-1),
      Home: choosable[0]?.value,
      End: choosable[choosable.length - 1]?.value,
    };
    if (!(event.key in target)) return;
    event.preventDefault();
    choose(target[event.key]);
  };

  return (
    <div className="ui-segmented" role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} onKeyDown={onKeyDown}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              if (element) buttons.current.set(option.value, element);
              else buttons.current.delete(option.value);
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled || option.disabled === true}
            className="ui-segmented__option"
            data-selected={selected ? '' : undefined}
            data-hover-icon={option.hoverIcon === undefined ? undefined : ''}
            {...(option.short === undefined ? {} : { title: option.label, 'aria-label': option.label })}
            onClick={() => choose(option.value)}
          >
            <span className="ui-segmented__text">{option.short ?? option.label}</span>
            {option.hoverIcon !== undefined && (
              <span className="ui-segmented__hover-icon" aria-hidden="true">
                {option.hoverIcon}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
