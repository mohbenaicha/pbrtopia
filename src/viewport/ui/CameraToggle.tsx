import { Icon, IconButton } from '../../ui-kit';
import type { Projection } from '../cameraRig';

interface CameraToggleProps {
  projection: Projection;
  onToggle: (next: Projection) => void;
}

const NAME: Record<Projection, string> = { perspective: 'Perspective', orthographic: 'Orthographic' };

// An icon-only button that shows the current projection's picture; a click asks for the other one.
export function CameraToggle({ projection, onToggle }: CameraToggleProps): React.JSX.Element {
  const next: Projection = projection === 'perspective' ? 'orthographic' : 'perspective';
  return <IconButton testId="viewport-camera" label={`${NAME[projection]} camera, switch to ${next}`} icon={<Icon name={projection} />} onClick={() => onToggle(next)} />;
}
