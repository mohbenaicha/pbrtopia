import { Select } from '@shared/ui-kit';
import { NORMAL_DIRECTIONS, type NormalDirection } from '@mat/storage';

interface NormalDirectionSelectProps {
  value: NormalDirection;
  onChange: (direction: NormalDirection) => void;
}

const LABELS: Record<NormalDirection, string> = { opengl: 'OpenGL', directx: 'DirectX' };
const OPTIONS = NORMAL_DIRECTIONS.map((direction) => ({ value: direction, label: LABELS[direction] }));

/** Preview R60: the label-less Normal direction dropdown (OpenGL or DirectX) that goes under the Normal sliders, drawn the way the HDRI dropdown is. */
export function NormalDirectionSelect({ value, onChange }: NormalDirectionSelectProps): React.JSX.Element {
  return <Select label="Normal direction" title="OpenGL and DirectX flip the green channel; pick the one your engine reads." hideLabel options={OPTIONS} value={value} onChange={(choice) => onChange(choice === 'directx' ? 'directx' : 'opengl')} />;
}
