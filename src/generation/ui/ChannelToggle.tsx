import { SegmentedControl } from '../../ui-kit';

type Channel = 'albedo' | 'normal' | 'roughness' | 'metalness';

// R3: albedo is the only channel in v1; the others are shown so the plan is visible, and cannot be chosen.
const OPTIONS: { value: Channel; label: string; disabled?: boolean }[] = [
  { value: 'albedo', label: 'Albedo' },
  { value: 'normal', label: 'Normal', disabled: true },
  { value: 'roughness', label: 'Roughness', disabled: true },
  { value: 'metalness', label: 'Metalness', disabled: true },
];

export function ChannelToggle(): React.JSX.Element {
  return <SegmentedControl label="Channel" options={OPTIONS} value="albedo" onChange={() => undefined} />;
}
