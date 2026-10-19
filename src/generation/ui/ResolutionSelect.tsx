import { Select } from '../../ui-kit';
import type { ResolutionKey, ResolutionOption } from '../catalog/modelTypes';

export interface ResolutionSelectProps {
  options: ResolutionOption[];
  experimental: ResolutionKey[]; // sizes the provider documents as experimental
  value: ResolutionKey | null;
  onChange: (key: ResolutionKey) => void;
}

// R4: the atlas sizes the selected model offers.
export function ResolutionSelect({ options, experimental, value, onChange }: ResolutionSelectProps): React.JSX.Element {
  return (
    <Select
      label="Resolution"
      options={options.map((option) => ({ value: option.key, label: `${option.key} (${option.sizePx} px)${experimental.includes(option.key) ? ' experimental' : ''}` }))}
      value={value ?? ''}
      emptyText="No sizes for this model"
      onChange={(key) => onChange(key as ResolutionKey)}
    />
  );
}
