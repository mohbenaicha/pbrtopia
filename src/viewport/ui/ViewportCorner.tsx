import { Icon, IconButton } from '../../ui-kit';
import type { Viewport } from '../createViewport';
import { AxisGizmo } from './AxisGizmo';
import { CameraToggle } from './CameraToggle';
import { useCameraPose, type PoseSource } from './useCameraPose';
import './ViewportCorner.css';

export type CornerViewport = PoseSource & Pick<Viewport, 'snapToAxis' | 'setProjection'>;

export interface ViewportCornerProps {
  viewport: CornerViewport;
  settingsOpen: boolean;
  onToggleSettings: () => void;
}

// Top-right of the viewport: the axis gizmo, and under it the settings gear and the camera icon side by side.
export function ViewportCorner({ viewport, settingsOpen, onToggleSettings }: ViewportCornerProps): React.JSX.Element {
  const { quaternion, projection } = useCameraPose(viewport);
  return (
    <div className="viewport-corner">
      <AxisGizmo quaternion={quaternion} onSelectAxis={viewport.snapToAxis} />
      <div className="viewport-corner__buttons">
        <IconButton testId="viewport-gear" label="Viewport settings" icon={<Icon name="gear" size={20} />} pressed={settingsOpen} onClick={onToggleSettings} />
        <CameraToggle projection={projection} onToggle={viewport.setProjection} />
      </div>
    </div>
  );
}
