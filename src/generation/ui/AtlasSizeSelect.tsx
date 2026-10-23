import { Select } from '../../ui-kit';
import type { AtlasKey, AtlasSizeOption } from '../catalog/atlasSizes';

interface AtlasSizeSelectProps {
  options: AtlasSizeOption[];
  value: AtlasKey;
  onChange: (key: AtlasKey) => void;
}

// R16: the size of the atlas sent to the model (the input); the output size is the Resolution control.
export function AtlasSizeSelect({ options, value, onChange }: AtlasSizeSelectProps): React.JSX.Element {
  return (
    <Select
      label="Atlas size"
      options={options.map((option) => ({ value: option.key, label: `${option.key} (${option.sizePx} px)` }))}
      value={value}
      emptyText="No atlas sizes on this device"
      onChange={(key) => onChange(key as AtlasKey)}
    />
  );
}
