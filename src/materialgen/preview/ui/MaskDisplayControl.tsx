import { useState, type ReactNode } from 'react';
import { Icon, IconButton, Popover, Slider, Toggle } from '@shared/ui-kit';
import './maskDisplayControl.css';

interface MaskDisplayControlProps {
  hasLabels: boolean; // the material has mask labels; the overlay needs them (R18)
  overlay: boolean;
  onOverlayChange: (on: boolean) => void;
  opacity: number; // preview pref maskOverlayOpacity (R40)
  onOpacityChange: (opacity: number) => void;
  controls?: ReactNode; // the Material Masks controls (masks R49), drawn under the opacity slider; built only while the popover is open, and not at all without labels
}

const NO_MASKS = 'There are no masks yet. Generate the material first.';

/**
 * Preview R28, R40: the Material Masks icon and its Mask display popover. A click opens the popover (overlay switch, opacity slider, then the Material Masks controls);
 * a click while it is open closes it. The icon is highlighted exactly while the popover is open, like the gear. Escape or a click elsewhere closes it. Always enabled.
 * The popover scrolls inside itself (maskDisplayControl.css), so a long list of components never makes the page or the app shell scroll.
 */
export function MaskDisplayControl({ hasLabels, overlay, onOverlayChange, opacity, onOpacityChange, controls }: MaskDisplayControlProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const trigger = <IconButton testId="preview-masks" label="Material Masks" icon={<Icon name="masks" />} expanded={open} onClick={() => setOpen(!open)} />;
  return (
    <Popover open={open} onClose={() => setOpen(false)} label="Mask display" trigger={trigger}>
      <div className="mask-display">
        <Toggle label="Mask overlay" checked={overlay && hasLabels} onChange={onOverlayChange} disabled={!hasLabels} hint={hasLabels ? undefined : NO_MASKS} />
        <Slider label="Overlay opacity" layout="row" value={opacity} min={0} max={1} step={0.01} format={(value) => value.toFixed(2)} onChange={onOpacityChange} />
        {hasLabels ? controls : null}
      </div>
    </Popover>
  );
}
