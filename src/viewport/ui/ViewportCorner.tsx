import type { ReactNode } from 'react';
import { Icon, IconButton, Popover } from '../../ui-kit';
import type { Viewport } from '../createViewport';
import { AxisGizmo } from './AxisGizmo';
import { CameraToggle } from './CameraToggle';
import { useCameraPose, type PoseSource } from './useCameraPose';
import './ViewportCorner.css';

export type CornerViewport = PoseSource & Pick<Viewport, 'snapToAxis' | 'setProjection'>;

export interface ViewportCornerProps {
  viewport: CornerViewport;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  settingsPanel: ReactNode; // the content of the popover under the gear
}

// Top-right of the viewport: the axis gizmo, and under it the settings gear (with its popover) and the camera icon side by side.
export function ViewportCorner({ viewport, settingsOpen, onSettingsOpenChange, settingsPanel }: ViewportCornerProps): React.JSX.Element {
  const { quaternion, projection } = useCameraPose(viewport);
  const gear = (
    <IconButton testId="viewport-gear" label="Viewport settings" icon={<Icon name="gear" size={20} />} pressed={settingsOpen} onClick={() => onSettingsOpenChange(!settingsOpen)} />
  );
  return (
    <div className="viewport-corner">
      <AxisGizmo quaternion={quaternion} onSelectAxis={viewport.snapToAxis} />
      <div className="viewport-corner__buttons">
        <Popover open={settingsOpen} onClose={() => onSettingsOpenChange(false)} label="Viewport settings" trigger={gear}>
          {settingsPanel}
        </Popover>
        <CameraToggle projection={projection} onToggle={viewport.setProjection} />
      </div>
    </div>
  );
}
