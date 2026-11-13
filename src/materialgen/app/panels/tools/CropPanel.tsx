import { useState } from 'react';
import { ControlRow, DEFAULT_CROP_AMOUNT, ToolPanel, describeCrop, fullRect, isFullRect, trimEdge, type CropEdge, type CropRect, type EditControl } from '@mat/imageops';
import { PlanePicker } from './PlanePicker';
import { useToolApply, type ToolOutcome } from './useToolApply';

interface CropPanelProps {
  size: number; // S: the maps are S x S
  onChange(rect: CropRect): void; // R53: every change, so the viewport follows each click
  onMark(edge: CropEdge | null): void; // R55: the edge handle the pointer or focus is on, or null
  onApply(rect: CropRect): Promise<ToolOutcome>;
  onClose(): void;
}

const AMOUNT: EditControl = { id: 'cropAmount', label: 'Pixels to remove', category: 'structure', kind: 'slider', min: 1, max: 10, step: 1, defaultValue: DEFAULT_CROP_AMOUNT };

/** Imageops R29, R30, R53, R57, R71: crop by edges. Each click on an edge handle of the plane trims the rectangle and reports it at once; Apply commits the one the panel holds. */
export function CropPanel({ size, onChange, onMark, onApply, onClose }: CropPanelProps): React.JSX.Element {
  const [rect, setRect] = useState<CropRect>(() => fullRect(size));
  const [amount, setAmount] = useState(AMOUNT.defaultValue);
  const { applying, error, apply } = useToolApply(onApply, onClose);

  const show = (next: CropRect): void => {
    if (next === rect) return; // a click that would leave too little changes nothing
    setRect(next);
    onChange(next);
  };

  return (
    <ToolPanel title="Crop" canApply={!isFullRect(rect, size)} applying={applying} error={error} onReset={() => show(fullRect(size))} onCancel={onClose} onApply={() => void apply(rect)}>
      <PlanePicker handles="edges" edgeTitle={(edge) => `Remove ${amount} px from the ${edge}`} onEdge={(edge) => show(trimEdge(rect, edge, amount))} onEdgeMark={onMark} />
      <ControlRow control={AMOUNT} value={amount} onChange={setAmount} />
      <p className="tool-panel__readout">{describeCrop(rect, size)}</p>
    </ToolPanel>
  );
}
