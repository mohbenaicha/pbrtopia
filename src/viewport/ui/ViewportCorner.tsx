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
  gridShown?: boolean;
  onGridShownChange?: (shown: boolean) => void;
  showAxisGizmo?: boolean; // all three default to true; the material preview turns them off (materialgen preview R29)
  showCameraToggle?: boolean;
  showGridToggle?: boolean;
  onResetView?: () => void; // replaces the viewport's own Reset view (the material preview resets its pose and dolly instead)
  moreButtons?: ReactNode; // icon buttons after the grid toggle (the app puts Edit mesh there)
  children?: ReactNode; // drawn under the buttons (the app puts the model's counts there)
}

// Top-right of the viewport: the axis gizmo, and under it the icon buttons two by two: the settings gear (with its popover), the camera, Reset view and the grid toggle; then whatever the caller adds.
export function ViewportCorner({
  viewport,
  settingsOpen,
  onSettingsOpenChange,
  settingsPanel,
  gridShown = false,
  onGridShownChange = () => undefined,
  showAxisGizmo = true,
  showCameraToggle = true,
  showGridToggle = true,
  onResetView,
  moreButtons,
  children,
}: ViewportCornerProps): React.JSX.Element {
  const { quaternion, projection } = useCameraPose(viewport);
  const gear = (
    <IconButton testId="viewport-gear" label="Viewport settings" icon={<Icon name="gear" />} pressed={settingsOpen} onClick={() => onSettingsOpenChange(!settingsOpen)} />
  );
  return (
    <div className="viewport-corner">
      {showAxisGizmo && <AxisGizmo quaternion={quaternion} onSelectAxis={viewport.snapToAxis} />}
      <div className="viewport-corner__buttons" data-testid="viewport-corner-buttons">
        <Popover open={settingsOpen} onClose={() => onSettingsOpenChange(false)} label="Viewport settings" trigger={gear}>
          {settingsPanel}
        </Popover>
        {showCameraToggle && <CameraToggle projection={projection} onToggle={viewport.setProjection} />}
        <IconButton testId="viewport-reset" label="Reset view" icon={<Icon name="reset" />} onClick={onResetView ?? viewport.resetView} />
        {showGridToggle && <IconButton testId="viewport-grid" label="Grid" icon={<Icon name="grid" />} pressed={gridShown} onClick={() => onGridShownChange(!gridShown)} />}
        {moreButtons}
      </div>
      {children}
    </div>
  );
}
