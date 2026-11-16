import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import './Disclosure.css';

/** The icon size of the buttons in a panel's heading bar (Crop, Mirror, Swap diagonals, Blend edges, Paint, AO): 20 px in the 38 px button. */
export const DISCLOSURE_ICON_PIXELS = 20;

const DisclosureOpenContext = createContext(true);

/** Whether the section around the caller is open (true outside any section): a kept-mounted body is hidden when closed, and can hold off work until it is shown. */
export function useDisclosureOpen(): boolean {
  return useContext(DisclosureOpenContext);
}

interface DisclosureProps {
  title: string;
  hint?: string; // what the section holds; without it the tooltip says what a click does
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean; // dimmed, not focusable, ignores clicks and keys
  keepMounted?: boolean; // R28: once opened, a closed body stays mounted (hidden), so its pictures and fields are not made again on open
  actions?: ReactNode; // R24: buttons drawn at the end of the heading bar; a button here does not toggle the section
  tone?: 'active' | 'previous'; // writes the heading in the active (green) or previous (blue) colour (textures R2, R3)
  tutorial?: string; // the guided tour's anchor: set on the heading bar when there are actions, otherwise on the section
  children?: ReactNode;
}

// A heading button that opens and closes a section below it. Closed content is not drawn at all, unless keepMounted.
export function Disclosure({ title, hint, open, onOpenChange, disabled = false, keepMounted = false, actions, tone, tutorial, children }: DisclosureProps): React.JSX.Element {
  const buttonId = useId();
  const regionId = useId();
  const [wasOpened, setWasOpened] = useState(open);
  if (open && !wasOpened) setWasOpened(true); // set during render (React's own pattern for state derived from a prop)
  const header = (
    <button type="button" id={buttonId} className="ui-disclosure__header" data-tone={tone} aria-expanded={open} aria-controls={open ? regionId : undefined} disabled={disabled} onClick={() => onOpenChange(!open)}>
      <span className="ui-disclosure__arrow" data-open={open ? '' : undefined} aria-hidden="true" />
      <Tooltip heading={title} text={hint ?? (open ? 'Click to hide this section.' : 'Click to show this section.')}><span className="ui-disclosure__title">{title}</span></Tooltip>
    </button>
  );
  return (
    <section className="ui-disclosure" data-tutorial={actions === undefined ? tutorial : undefined}>
      {actions === undefined ? header : <div className="ui-disclosure__bar" data-tutorial={tutorial}>{header}{actions}</div>}
      {(open || (keepMounted && wasOpened)) && (
        <div className="ui-disclosure__body" id={regionId} role="region" aria-labelledby={buttonId} hidden={!open}>
          <DisclosureOpenContext.Provider value={open}>{children}</DisclosureOpenContext.Provider>
        </div>
      )}
    </section>
  );
}
