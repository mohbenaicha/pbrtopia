import { SegmentedControl } from '../../ui-kit';
import { hasRecipe } from '../prompts/mapRecipes';

type Channel = 'albedo' | 'normal' | 'roughness' | 'metalness';

// R3, R30: a channel can be chosen when it has a prompt recipe (albedo only for now); the others are shown so the plan is visible.
const CHANNELS: { value: Channel; label: string }[] = [
  { value: 'albedo', label: 'Albedo' },
  { value: 'normal', label: 'Normal' },
  { value: 'roughness', label: 'Roughness' },
  { value: 'metalness', label: 'Metalness' },
];
const OPTIONS = CHANNELS.map((channel) => ({ ...channel, disabled: !hasRecipe(channel.value) }));

export function ChannelToggle(): React.JSX.Element {
  return <SegmentedControl label="Channel" options={OPTIONS} value="albedo" onChange={() => undefined} />;
}
