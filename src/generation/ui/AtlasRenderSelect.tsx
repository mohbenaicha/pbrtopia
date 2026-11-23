import { Select } from '../../ui-kit';
import { ATLAS_RENDER_OPTIONS, MASK_ATLAS_RENDER_LABEL, type AtlasRender } from '../atlasRender';

interface AtlasRenderSelectProps {
  value: AtlasRender;
  onChange: (render: AtlasRender) => void;
  masks?: boolean; // mask-generation R2: the one look of a mask atlas, shown and not changeable
}

const TITLE = 'How the views are drawn into the picture sent to the model.';

// R37: how the snapshots of the atlas are drawn: the plain grey render, or the model the way the viewport shows it.
export function AtlasRenderSelect({ value, onChange, masks = false }: AtlasRenderSelectProps): React.JSX.Element {
  if (masks) return <Select label="Atlas render" title={TITLE} options={[{ value: 'color', label: MASK_ATLAS_RENDER_LABEL }]} value="color" opensUp disabled onChange={() => undefined} />;
  return <Select label="Atlas render" title={TITLE} options={ATLAS_RENDER_OPTIONS.map(({ value: option, label }) => ({ value: option, label }))} value={value} opensUp onChange={(render) => onChange(render as AtlasRender)} />;
}
