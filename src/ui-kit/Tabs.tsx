import { useRef, type KeyboardEvent } from 'react';
import './Tabs.css';

export interface TabOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface TabsProps<T extends string> {
  label: string; // accessible name of the tab list
  tabs: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

// A row of tabs that switch a panel the owner draws. Arrow keys move to the next enabled tab; only the chosen tab is in the tab order.
export function Tabs<T extends string>({ label, tabs, value, onChange }: TabsProps<T>): React.JSX.Element {
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const choosable = tabs.filter((tab) => !tab.disabled);

  const choose = (next: T | undefined): void => {
    if (next === undefined) return;
    onChange(next);
    buttons.current.get(next)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = choosable.findIndex((tab) => tab.value === value);
    const step = (offset: number): T | undefined => choosable[(index + offset + choosable.length) % choosable.length]?.value;
    const target: Record<string, T | undefined> = {
      ArrowRight: step(1),
      ArrowLeft: step(-1),
      Home: choosable[0]?.value,
      End: choosable[choosable.length - 1]?.value,
    };
    if (!(event.key in target)) return;
    event.preventDefault();
    choose(target[event.key]);
  };

  return (
    <div className="ui-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(element) => {
              if (element) buttons.current.set(tab.value, element);
              else buttons.current.delete(tab.value);
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={tab.disabled === true}
            className="ui-tabs__tab"
            data-selected={selected ? '' : undefined}
            onClick={() => choose(tab.value)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
