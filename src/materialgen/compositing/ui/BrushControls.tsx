import { SegmentedControl, Slider, Toggle } from '@shared/ui-kit';
import { DEFAULT_BRUSH, type BrushParams } from '../plan/brushParams';

interface BrushControlsProps {
  brush: BrushParams;
  onChange: (brush: BrushParams) => void;
}

const twoDecimals = (value: number): string => value.toFixed(2);
const degrees = (value: number): string => `${Math.round(value)}°`;
const signed = (value: number): string => `${value > 0 ? '+' : ''}${value.toFixed(2)}`;

/** Compositing R9: every brush control with its range; each slider has the reset arrow (preview R61). Height and Edge burn enable their own sub-controls. */
export function BrushControls({ brush, onChange }: BrushControlsProps): React.JSX.Element {
  const set = (patch: Partial<BrushParams>): void => onChange({ ...brush, ...patch });
  return (
    <div className="brush-controls">
      <Slider label="Size" layout="row" value={brush.size} min={0.02} max={0.5} step={0.005} format={twoDecimals} resetTo={DEFAULT_BRUSH.size} onChange={(size) => set({ size })} />
      <Slider label="Strength" layout="row" value={brush.strength} min={0} max={1} step={0.01} format={twoDecimals} resetTo={DEFAULT_BRUSH.strength} onChange={(strength) => set({ strength })} />
      <Slider label="Hardness" layout="row" value={brush.hardness} min={0} max={1} step={0.01} format={twoDecimals} resetTo={DEFAULT_BRUSH.hardness} onChange={(hardness) => set({ hardness })} />
      <Slider label="Distance" layout="row" value={brush.distance} min={0.05} max={2} step={0.05} format={twoDecimals} resetTo={DEFAULT_BRUSH.distance} onChange={(distance) => set({ distance })} />
      <Slider label="Rotation" layout="row" value={brush.rotation} min={-180} max={180} step={1} format={degrees} resetTo={DEFAULT_BRUSH.rotation} disabled={brush.randomRotation} onChange={(rotation) => set({ rotation })} />
      <Toggle label="Random rotation" checked={brush.randomRotation} onChange={(randomRotation) => set({ randomRotation })} />
      <Toggle label="Height" checked={brush.height.on} onChange={(on) => set({ height: { ...brush.height, on } })} />
      <Slider label="Height level" layout="row" value={brush.height.level} min={-1} max={1} step={0.01} format={signed} resetTo={DEFAULT_BRUSH.height.level} disabled={!brush.height.on} onChange={(level) => set({ height: { ...brush.height, level } })} />
      <Toggle label="Additive" checked={brush.height.additive} disabled={!brush.height.on} onChange={(additive) => set({ height: { ...brush.height, additive } })} />
      <Toggle label="Edge burn" checked={brush.edgeBurn.on} onChange={(on) => set({ edgeBurn: { ...brush.edgeBurn, on } })} />
      <SegmentedControl
        label="Edge burn direction"
        options={[{ value: 'raise', label: 'Raise' }, { value: 'dent', label: 'Dent' }]}
        value={brush.edgeBurn.direction}
        disabled={!brush.edgeBurn.on}
        onChange={(direction) => set({ edgeBurn: { ...brush.edgeBurn, direction } })}
      />
    </div>
  );
}
