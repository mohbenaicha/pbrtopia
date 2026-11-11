import { useState } from 'react';
import { Button, TextInput } from '@shared/ui-kit';
import { DEFAULT_CROP_AMOUNT, ToolPanel, describeCrop, fullRect, isFullRect, trimEdge, type CropEdge, type CropRect } from '@mat/imageops';
import { useToolApply, type ToolOutcome } from './useToolApply';

interface CropPanelProps {
  size: number; // S: the maps are S x S
  onChange(rect: CropRect): void; // R53: every change, so the viewport follows each click
  onMark(edge: CropEdge | null): void; // R55: the edge button the pointer or focus is on, or null
  onApply(rect: CropRect): Promise<ToolOutcome>;
  onClose(): void;
}

const EDGES: ReadonlyArray<{ edge: CropEdge; label: string }> = [
  { edge: 'top', label: 'Top' },
  { edge: 'left', label: 'Left' },
  { edge: 'right', label: 'Right' },
  { edge: 'bottom', label: 'Bottom' },
];

/** Imageops R29, R30, R53, R57: crop by edges. Each click trims the rectangle and reports it at once; Apply commits the one the panel holds. */
export function CropPanel({ size, onChange, onMark, onApply, onClose }: CropPanelProps): React.JSX.Element {
  const [rect, setRect] = useState<CropRect>(() => fullRect(size));
  const [amountText, setAmountText] = useState(String(DEFAULT_CROP_AMOUNT));
  const { applying, error, apply } = useToolApply(onApply, onClose);
  const amount = Math.max(1, Number.parseInt(amountText, 10) || 1);

  const show = (next: CropRect): void => {
    if (next === rect) return; // a click that would leave too little changes nothing
    setRect(next);
    onChange(next);
  };

  return (
    <ToolPanel title="Crop" canApply={!isFullRect(rect, size)} applying={applying} error={error} onReset={() => show(fullRect(size))} onCancel={onClose} onApply={() => void apply(rect)}>
      <TextInput
        label="Pixels to remove"
        value={amountText}
        onChange={(text) => setAmountText(text.replace(/\D/g, ''))}
        onBlur={() => setAmountText(String(amount))} // an empty box or 0 becomes 1 when it is left
      />
      <div className="tool-panel__group">
        {EDGES.map(({ edge, label }) => (
          // R55: the marker line shows on the edge the pointer or keyboard focus is on; focus events bubble from the button
          <span key={edge} onMouseEnter={() => onMark(edge)} onMouseLeave={() => onMark(null)} onFocus={() => onMark(edge)} onBlur={() => onMark(null)}>
            <Button variant="secondary" title={`Remove ${amount} px from the ${edge}`} onClick={() => show(trimEdge(rect, edge, amount))}>{label}</Button>
          </span>
        ))}
      </div>
      <p className="tool-panel__readout">{describeCrop(rect, size)}</p>
    </ToolPanel>
  );
}
