import { Disclosure } from '@shared/ui-kit';
import { MasksPanel } from '@mat/masks';
import { useMasksPanel, type MasksPanelPorts } from './useMasksPanel';

/** The panel with its hook; mounted by the section once it is first opened, so nothing loads before the person asks for the masks. */
function MasksBody(ports: MasksPanelPorts): React.JSX.Element {
  return <MasksPanel {...useMasksPanel(ports)} />;
}

interface MasksSectionProps extends MasksPanelPorts {
  open: boolean; // owned by the project view: the viewport's Material Masks icon opens it too (preview R28)
  onOpenChange(open: boolean): void;
}

/** Masks R48, R49: the Material Masks section of the left panel, closed at first. The masks come from the generation flow, so there is no section before they exist. */
export function MasksSection({ open, onOpenChange, ...ports }: MasksSectionProps): React.JSX.Element | null {
  if (ports.masksRecord === undefined) return null;
  return (
    <Disclosure title="Material Masks" open={open} onOpenChange={onOpenChange} keepMounted>
      <MasksBody {...ports} />
    </Disclosure>
  );
}
