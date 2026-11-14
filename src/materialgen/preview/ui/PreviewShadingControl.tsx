import { Icon, SegmentedControl, type SegmentOption } from '@shared/ui-kit';
import type { PreviewShading } from '../math/flatViews';
import './previewShadingControl.css';

const eye = <Icon name="eye" size={16} />;

const OPTIONS: SegmentOption<PreviewShading>[] = [
  { value: 'lit', label: 'Shaded', hint: 'Shows the finished material, lit by the environment.' },
  { value: 'albedo', label: 'Albedo', short: 'A', hoverIcon: eye, hint: 'Shows only the base colour, with no lighting.' },
  { value: 'normal', label: 'Normal', short: 'N', hoverIcon: eye, hint: 'Shows the normal map as colours.' },
  { value: 'rough', label: 'Rough', short: 'R', hoverIcon: eye, hint: 'Shows roughness as grey: white is matte, black is shiny.' },
  { value: 'metal', label: 'Metal', short: 'M', hoverIcon: eye, hint: 'Shows metalness as grey: white is metal, black is not.' },
  { value: 'height', label: 'Height', short: 'H', hoverIcon: eye, hint: 'Shows the height map as grey: white is high, black is low.' },
  { value: 'ao', label: 'AO', short: 'AO', hoverIcon: eye, hint: 'Shows ambient occlusion: how much each spot is hidden from light.' },
];

/** Preview R51: the shading-mode selector of the projection app, extended with Height and AO; the app puts it at the top of the left panel, as the projection app does. */
export function PreviewShadingControl({ value, onChange }: { value: PreviewShading; onChange: (shading: PreviewShading) => void }): React.JSX.Element {
  return (
    <div className="preview-shading" data-testid="preview-shading">
      <SegmentedControl label="Shading mode" options={OPTIONS} value={value} onChange={onChange} />
    </div>
  );
}
