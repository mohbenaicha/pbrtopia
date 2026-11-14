import type { CSSProperties } from 'react';
import type { Quaternion } from 'three';
import type { ViewAxis } from '../cameraRig';
import { Tooltip } from '../../ui-kit';
import { computeGizmoDiscs } from './gizmoDiscs';
import './AxisGizmo.css';

const DISC_ORBIT_RADIUS = 36; // pixels from the gizmo centre

interface AxisGizmoProps {
  quaternion: Quaternion; // the camera orientation the discs follow
  onSelectAxis: (axis: ViewAxis) => void;
}

// Six discs placed from the camera orientation; clicking one looks at the model from that side (Blender-style).
export function AxisGizmo({ quaternion, onSelectAxis }: AxisGizmoProps): React.JSX.Element {
  return (
    <div className="axis-gizmo" data-testid="viewport-gizmo">
      {computeGizmoDiscs(quaternion, DISC_ORBIT_RADIUS).map((disc) => {
        const style = { '--disc-x': `${disc.x}px`, '--disc-y': `${disc.y}px`, zIndex: Math.round((disc.depth + 1) * 10) + 1 } as CSSProperties;
        return (
          <Tooltip key={disc.axis} heading={`View from ${disc.axis.toUpperCase()}`} text={`Turns the camera to look at the model from the ${disc.axis.toUpperCase()} side.`}>
            <button
              type="button"
              className="axis-gizmo__disc"
              data-axis={disc.axis}
              data-positive={disc.positive ? '' : undefined}
              aria-label={`View from ${disc.axis.toUpperCase()}`}
              style={style}
              onClick={() => onSelectAxis(disc.axis)}
            >
              {disc.positive ? disc.label : ''}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
