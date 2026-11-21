import { SegmentedControl } from '../../ui-kit';
import type { ChannelAvailabilityMap, GenerateChannel } from '../channels/describeChannelAvailability';

interface ChannelToggleProps {
  value: GenerateChannel;
  availability: ChannelAvailabilityMap; // normal-map R2: which options can be chosen, and why not
  onChange: (channel: GenerateChannel) => void;
  disabled?: boolean; // a run is going: the channel it started with stays
}

const CHANNELS: { value: GenerateChannel; label: string; hint: string }[] = [
  { value: 'albedo', label: 'Albedo', hint: 'The base colour of the surface, without lighting.' },
  { value: 'normal', label: 'Normal', hint: 'Surface relief that catches the light, made from the albedo picture.' },
  { value: 'metal-rough', label: 'Metal-Roughness', hint: 'Which parts are metal and how shiny or matte each part is.' },
];

// normal-map R1, R2: Albedo | Normal | Metal-Roughness. An option that cannot be chosen now says why in its tooltip.
export function ChannelToggle({ value, availability, onChange, disabled = false }: ChannelToggleProps): React.JSX.Element {
  const options = CHANNELS.map((channel) => {
    const state = availability[channel.value];
    return { ...channel, disabled: !state.enabled, hint: state.enabled ? channel.hint : (state.reason ?? channel.hint) };
  });
  return <SegmentedControl label="Channel" hint="Which material map to generate." options={options} value={value} onChange={onChange} disabled={disabled} />;
}
