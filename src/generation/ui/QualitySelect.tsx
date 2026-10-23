import { Select } from '../../ui-kit';

interface QualitySelectProps {
  levels: string[]; // the provider's own names, in the order to show
  value: string | null;
  onChange: (level: string) => void;
}

// R5: the quality levels of the selected model, named as the provider names them.
export function QualitySelect({ levels, value, onChange }: QualitySelectProps): React.JSX.Element {
  return <Select label="Quality" options={levels.map((level) => ({ value: level, label: level }))} value={value ?? ''} emptyText="No quality levels for this model" onChange={onChange} />;
}
