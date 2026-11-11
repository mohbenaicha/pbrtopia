import { MasksPanel } from '@mat/masks';
import { useMasksPanel, type MasksPanelPorts } from './useMasksPanel';

/**
 * Masks R48, R49: the Material Masks controls for the viewport's Mask display popover. The popover mounts them when it opens, so nothing loads (the base-material
 * table, the labels) before the person asks for the masks. The masks come from the generation flow, so there is nothing to draw before they exist.
 */
export function MasksControls(ports: MasksPanelPorts): React.JSX.Element | null {
  return ports.masksRecord === undefined ? null : <MasksBody {...ports} />;
}

/** The panel with its hook; kept apart so the hook runs only when there is a record to show. */
function MasksBody(ports: MasksPanelPorts): React.JSX.Element {
  return <MasksPanel {...useMasksPanel(ports)} />;
}
