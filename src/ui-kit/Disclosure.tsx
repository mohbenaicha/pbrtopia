import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import './Disclosure.css';

const DisclosureOpenContext = createContext(true);

/** Whether the section around the caller is open (true outside any section): a kept-mounted body is hidden when closed, and can hold off work until it is shown. */
export function useDisclosureOpen(): boolean {
  return useContext(DisclosureOpenContext);
}

interface DisclosureProps {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean; // dimmed, not focusable, ignores clicks and keys
  keepMounted?: boolean; // R28: once opened, a closed body stays mounted (hidden), so its pictures and fields are not made again on open
  actions?: ReactNode; // R24: buttons drawn at the end of the heading bar; a button here does not toggle the section
  tone?: 'active' | 'previous'; // writes the heading in the active (green) or previous (blue) colour (textures R2, R3)
  children?: ReactNode;
}

// A heading button that opens and closes a section below it. Closed content is not drawn at all, unless keepMounted.
export function Disclosure({ title, open, onOpenChange, disabled = false, keepMounted = false, actions, tone, children }: DisclosureProps): React.JSX.Element {
  const buttonId = useId();
  const regionId = useId();
  const [wasOpened, setWasOpened] = useState(open);
  if (open && !wasOpened) setWasOpened(true); // set during render (React's own pattern for state derived from a prop)
  const header = (
    <button type="button" id={buttonId} className="ui-disclosure__header" data-tone={tone} aria-expanded={open} aria-controls={open ? regionId : undefined} disabled={disabled} onClick={() => onOpenChange(!open)}>
      <span className="ui-disclosure__arrow" data-open={open ? '' : undefined} aria-hidden="true" />
      {title}
    </button>
  );
  return (
    <section className="ui-disclosure">
      {actions === undefined ? header : <div className="ui-disclosure__bar">{header}{actions}</div>}
      {(open || (keepMounted && wasOpened)) && (
        <div className="ui-disclosure__body" id={regionId} role="region" aria-labelledby={buttonId} hidden={!open}>
          <DisclosureOpenContext.Provider value={open}>{children}</DisclosureOpenContext.Provider>
        </div>
      )}
    </section>
  );
}
