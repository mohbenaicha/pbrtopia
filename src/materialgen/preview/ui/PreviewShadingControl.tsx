import { Icon, SegmentedControl, type SegmentOption } from '@shared/ui-kit';
import type { PreviewShading } from '../math/flatViews';
import './previewShadingControl.css';

const eye = <Icon name="eye" size={16} />;

const OPTIONS: SegmentOption<PreviewShading>[] = [
  { value: 'lit', label: 'Shaded' },
  { value: 'albedo', label: 'Albedo', short: 'A', hoverIcon: eye },
  { value: 'normal', label: 'Normal', short: 'N', hoverIcon: eye },
  { value: 'rough', label: 'Rough', short: 'R', hoverIcon: eye },
  { value: 'metal', label: 'Metal', short: 'M', hoverIcon: eye },
  { value: 'height', label: 'Height', short: 'H', hoverIcon: eye },
  { value: 'ao', label: 'AO', short: 'AO', hoverIcon: eye },
];

/** Preview R51: the shading-mode selector of the projection app, extended with Height and AO; the app puts it at the top of the left panel, as the projection app does. */
export function PreviewShadingControl({ value, onChange }: { value: PreviewShading; onChange: (shading: PreviewShading) => void }): React.JSX.Element {
  return (
    <div className="preview-shading" data-testid="preview-shading">
      <SegmentedControl label="Shading mode" options={OPTIONS} value={value} onChange={onChange} />
    </div>
  );
}
