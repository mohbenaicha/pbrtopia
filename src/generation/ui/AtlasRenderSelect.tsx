import { Select } from '../../ui-kit';
import { ATLAS_RENDER_OPTIONS, type AtlasRender } from '../atlasRender';

interface AtlasRenderSelectProps {
  value: AtlasRender;
  onChange: (render: AtlasRender) => void;
}

// R37: how the snapshots of the atlas are drawn: the plain grey render, or the model the way the viewport shows it.
export function AtlasRenderSelect({ value, onChange }: AtlasRenderSelectProps): React.JSX.Element {
  return <Select label="Atlas render" title="How the views are drawn into the picture sent to the model." options={ATLAS_RENDER_OPTIONS.map(({ value: option, label }) => ({ value: option, label }))} value={value} opensUp onChange={(render) => onChange(render as AtlasRender)} />;
}
