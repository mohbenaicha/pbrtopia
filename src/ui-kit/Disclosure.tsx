import { useId, type ReactNode } from 'react';
import './Disclosure.css';

export interface DisclosureProps {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean; // dimmed, not focusable, ignores clicks and keys
  children?: ReactNode;
}

// A heading button that opens and closes a section below it. Closed content is not drawn at all.
export function Disclosure({ title, open, onOpenChange, disabled = false, children }: DisclosureProps): React.JSX.Element {
  const buttonId = useId();
  const regionId = useId();
  return (
    <section className="ui-disclosure">
      <button type="button" id={buttonId} className="ui-disclosure__header" aria-expanded={open} aria-controls={open ? regionId : undefined} disabled={disabled} onClick={() => onOpenChange(!open)}>
        <span className="ui-disclosure__arrow" data-open={open ? '' : undefined} aria-hidden="true" />
        {title}
      </button>
      {open && (
        <div className="ui-disclosure__body" id={regionId} role="region" aria-labelledby={buttonId}>
          {children}
        </div>
      )}
    </section>
  );
}
