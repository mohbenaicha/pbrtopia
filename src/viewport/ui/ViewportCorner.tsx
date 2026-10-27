import type { ReactNode } from 'react';
import { Icon, IconButton, Popover } from '../../ui-kit';
import type { Viewport } from '../createViewport';
import { AxisGizmo } from './AxisGizmo';
import { CameraToggle } from './CameraToggle';
import { useCameraPose, type PoseSource } from './useCameraPose';
import './ViewportCorner.css';

export type CornerViewport = PoseSource & Pick<Viewport, 'snapToAxis' | 'setProjection' | 'resetView'>;

interface ViewportCornerProps {
  viewport: CornerViewport;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  settingsPanel: ReactNode; // the content of the popover under the gear
  gridShown: boolean;
  onGridShownChange: (shown: boolean) => void;
  children?: ReactNode; // drawn under the buttons (the app puts the model's counts there)
}

// Top-right of the viewport: the axis gizmo, and under it the icon buttons two by two: the settings gear (with its popover), the camera, Reset view and the grid toggle; then whatever the caller adds.
export function ViewportCorner({ viewport, settingsOpen, onSettingsOpenChange, settingsPanel, gridShown, onGridShownChange, children }: ViewportCornerProps): React.JSX.Element {
  const { quaternion, projection } = useCameraPose(viewport);
  const gear = (
    <IconButton testId="viewport-gear" label="Viewport settings" icon={<Icon name="gear" size={20} />} pressed={settingsOpen} onClick={() => onSettingsOpenChange(!settingsOpen)} />
  );
  return (
    <div className="viewport-corner">
      <AxisGizmo quaternion={quaternion} onSelectAxis={viewport.snapToAxis} />
      <div className="viewport-corner__buttons" data-testid="viewport-corner-buttons">
        <Popover open={settingsOpen} onClose={() => onSettingsOpenChange(false)} label="Viewport settings" trigger={gear}>
          {settingsPanel}
        </Popover>
        <CameraToggle projection={projection} onToggle={viewport.setProjection} />
        <IconButton testId="viewport-reset" label="Reset view" icon={<Icon name="reset" size={20} />} onClick={viewport.resetView} />
        <IconButton testId="viewport-grid" label="Grid" icon={<Icon name="grid" size={20} />} pressed={gridShown} onClick={() => onGridShownChange(!gridShown)} />
      </div>
      {children}
    </div>
  );
}
