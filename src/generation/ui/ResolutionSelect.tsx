import { Select } from '../../ui-kit';
import type { ResolutionKey, ResolutionOption } from '../catalog/modelTypes';

interface ResolutionSelectProps {
  options: ResolutionOption[];
  experimental: ResolutionKey[]; // sizes the provider documents as experimental
  value: ResolutionKey | null;
  onChange: (key: ResolutionKey) => void;
  label?: string;
}

// R4: the output sizes the selected model offers.
export function ResolutionSelect({ options, experimental, value, onChange, label = 'Resolution' }: ResolutionSelectProps): React.JSX.Element {
  return (
    <Select
      label={label}
      title="The size of the picture the model returns; larger gives more detail and costs more."
      options={options.map((option) => ({ value: option.key, label: `${option.key} (${option.sizePx} px)${experimental.includes(option.key) ? ' experimental' : ''}` }))}
      value={value ?? ''}
      emptyText="No sizes for this model"
      onChange={(key) => onChange(key as ResolutionKey)}
    />
  );
}
