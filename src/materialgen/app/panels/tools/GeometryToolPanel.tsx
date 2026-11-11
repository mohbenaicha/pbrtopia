import { useRef } from 'react';
import { fullRect, type CropEdge, type CropRect, type MirrorPlan } from '@mat/imageops';
import type { ToolTransform } from '@mat/preview';
import { CropPanel } from './CropPanel';
import { MirrorPanel } from './MirrorPanel';
import { cropTransform, mirrorTransform } from './toolTransformOf';
import type { ToolOutcome } from './useToolApply';

export type GeometryToolName = 'crop' | 'mirror';

interface GeometryToolPanelProps {
  tool: GeometryToolName;
  size: number; // S
  onTransform(transform: ToolTransform): void; // every change of the settings, for the viewport (imageops R53)
  onApplyCrop(rect: CropRect): Promise<ToolOutcome>;
  onApplyMirror(plan: MirrorPlan): Promise<ToolOutcome>;
  onClose(): void;
}

/**
 * Imageops R52-R56: the open Crop or Mirror panel. Each change of its settings becomes the viewport's transform at once (R54); it reads and holds no map,
 * so there is nothing to open or release.
 */
export function GeometryToolPanel({ tool, size, onTransform, onApplyCrop, onApplyMirror, onClose }: GeometryToolPanelProps): React.JSX.Element {
  const rect = useRef<CropRect>(fullRect(size)); // the crop the panel holds and the edge button under the pointer; each shows both (R55)
  const edge = useRef<CropEdge | null>(null);
  const showCrop = (): void => onTransform(cropTransform(rect.current, size, edge.current));
  return tool === 'crop' ? (
    <CropPanel
      size={size}
      onChange={(next) => { rect.current = next; showCrop(); }}
      onMark={(next) => { edge.current = next; showCrop(); }}
      onApply={onApplyCrop}
      onClose={onClose}
    />
  ) : (
    <MirrorPanel onChange={(plan, selection) => onTransform(mirrorTransform(plan, selection))} onApply={onApplyMirror} onClose={onClose} />
  );
}
