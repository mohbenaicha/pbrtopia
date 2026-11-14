import { SegmentedControl } from '../../ui-kit';
import { hasRecipe } from '../prompts/mapRecipes';

type Channel = 'albedo' | 'normal' | 'roughness' | 'metalness';

// R3, R30: a channel can be chosen when it has a prompt recipe (albedo only for now); the others are shown so the plan is visible.
const CHANNELS: { value: Channel; label: string; hint: string }[] = [
  { value: 'albedo', label: 'Albedo', hint: 'The base colour of the surface, without lighting.' },
  { value: 'normal', label: 'Normal', hint: 'Fine surface bumps that catch the light.' },
  { value: 'roughness', label: 'Roughness', hint: 'Which parts are shiny and which are matte.' },
  { value: 'metalness', label: 'Metalness', hint: 'Which parts behave like bare metal.' },
];
const OPTIONS = CHANNELS.map((channel) => ({ ...channel, disabled: !hasRecipe(channel.value) }));

export function ChannelToggle(): React.JSX.Element {
  return <SegmentedControl label="Channel" hint="Which material map to generate; only albedo is available so far." options={OPTIONS} value="albedo" onChange={() => undefined} />;
}
