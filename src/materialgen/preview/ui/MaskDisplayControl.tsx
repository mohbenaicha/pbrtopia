import { useEffect, useState } from 'react';
import { Icon, IconButton, Popover, Slider, Toggle } from '@shared/ui-kit';
import './maskDisplayControl.css';

interface MaskDisplayControlProps {
  hasLabels: boolean; // the material has mask labels; the overlay needs them (R18)
  overlay: boolean;
  onOverlayChange: (on: boolean) => void;
  opacity: number; // preview pref maskOverlayOpacity (R40)
  onOpacityChange: (opacity: number) => void;
  panelOpen: boolean; // the Material Masks section of the right panel is open (R28)
  onPanelOpenChange: (open: boolean) => void;
}

const NO_MASKS = 'There are no masks yet. Create them in Material Masks.';

/**
 * Preview R28, R40: the Material Masks icon. A click opens the Material Masks panel and the mask display options (overlay switch and opacity); a click while the options are
 * open closes both. The icon is highlighted exactly while the options are open, like the gear: Escape or a click elsewhere closes the options (and so the highlight) and leaves
 * the panel open, and closing the panel from its own header closes the options. Always enabled.
 */
export function MaskDisplayControl({ hasLabels, overlay, onOverlayChange, opacity, onOpacityChange, panelOpen, onPanelOpenChange }: MaskDisplayControlProps): React.JSX.Element {
  const [open, setOpen] = useState(false); // the options
  useEffect(() => {
    if (!panelOpen) setOpen(false);
  }, [panelOpen]);
  const toggle = (): void => {
    const next = !open;
    setOpen(next);
    onPanelOpenChange(next);
  };
  const trigger = <IconButton testId="preview-masks" label="Material Masks" icon={<Icon name="masks" />} expanded={open} onClick={toggle} />;
  return (
    <Popover open={open} onClose={() => setOpen(false)} label="Mask display" trigger={trigger}>
      <div className="mask-display">
        <Toggle label="Mask overlay" checked={overlay && hasLabels} onChange={onOverlayChange} disabled={!hasLabels} hint={hasLabels ? undefined : NO_MASKS} />
        <Slider label="Overlay opacity" layout="row" value={opacity} min={0} max={1} step={0.01} format={(value) => value.toFixed(2)} onChange={onOpacityChange} />
      </div>
    </Popover>
  );
}
