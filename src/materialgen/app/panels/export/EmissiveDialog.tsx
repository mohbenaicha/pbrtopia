import { useEffect, useMemo, useRef, useState } from 'react';
import type { RawRecord } from '@shared/projects';
import { CommitSlider } from '@shared/ui-kit';
import { MAX_PREVIEW_SIZE, OpDialog, type PixelImage } from '@mat/imageops';
import { MaskSwatchGrid } from '@shared/materialMasks/ui';
import { useFilterMaskScope } from '../useFilterMaskScope';
import { useStoredPicture } from '../useMapPictures';
import { buildGlowOverlay } from './emissiveGlowOverlay';

interface EmissiveDialogProps {
  albedoKey: string | null; // the albedo's (or diffuse's) working copy: the one picture shown; null when the project has none
  labelsKey: string;
  masksRecord: RawRecord | undefined;
  size: number; // S: the size the plane is baked at (the labels' size)
  readBlob(key: string): Promise<Blob | null>;
  onConfirm(plane: PixelImage): void;
  onCancel(): void;
}

const MASK_HINT = 'Select the materials that glow';
const SOFTNESS_HINT = 'How far the glow fades out past the edge of the selected materials.';
const MAX_SOFTNESS = 50; // export R40: a glow wants a longer falloff than the masks' 4 px Feather
const SOFTNESS_RANGE = { min: 0, max: MAX_SOFTNESS, step: 1, format: (value: number): string => `${value} px` };

/** Resolves once the browser has drawn a frame, so a state change made before the call is on screen before the work after it starts. */
const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

/**
 * Export R38-R40, R44: the emissive dialog, drawn over the export dialog. The albedo shows with the selected materials lit, one Softness slider
 * fades the edge, and Confirm bakes the coverage at S as one grey plane (white where selected, black elsewhere). Nothing is saved here:
 * the plane goes to `onConfirm`, and Cancel or Escape to `onCancel`.
 */
export function EmissiveDialog({ albedoKey, labelsKey, masksRecord, size, readBlob, onConfirm, onCancel }: EmissiveDialogProps): React.JSX.Element {
  const previewSize = Math.min(size, MAX_PREVIEW_SIZE);
  const [softness, setSoftness] = useState(0);
  const [baking, setBaking] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const scope = useFilterMaskScope({ masksRecord, labelsKey, size, previewSize, readBlob, feather: softness, maxFeather: MAX_SOFTNESS }); // R40: Softness, not the project's Feather
  const albedo = useStoredPicture(albedoKey, readBlob);
  const sources = useMemo(() => [{ id: 'albedo', label: 'Albedo', src: albedo.src, failed: albedoKey === null || albedo.failed }], [albedo.src, albedo.failed, albedoKey]);
  const overlay = useMemo(
    () => (scope.previewCoverage === null ? scope.overlay : buildGlowOverlay(scope.previewCoverage)),
    [scope.previewCoverage, scope.overlay],
  );
  const reset = (): void => {
    setSoftness(0);
    scope.selected.forEach((label) => scope.toggle(label));
  };
  const confirm = async (): Promise<void> => {
    setBaking(true); // R40: the button shows its spinner while the blur runs, so the dialog does not look frozen
    await nextFrame();
    if (!alive.current) return; // torn down in that frame: nothing is baked and nothing is called
    const plane = scope.finalCoverage(); // one synchronous step: a Cancel or teardown cannot land in the middle of it
    if (plane === null) setBaking(false);
    else onConfirm(plane);
  };

  return (
    <OpDialog
      title="Emissive map"
      sources={sources}
      canApply={scope.selected.length > 0}
      applying={baking}
      applyLabel="Confirm"
      error={null}
      stacked
      scope={scope.swatches === null ? null : <MaskSwatchGrid rows={scope.swatches.rows} palette={scope.swatches.palette} selected={scope.selected} onSelect={scope.toggle} onHighlight={scope.highlight} hint={MASK_HINT} />}
      overlay={overlay}
      onReset={reset}
      onCancel={onCancel}
      onApply={() => void confirm()}
    >
      <CommitSlider label="Softness" hint={SOFTNESS_HINT} layout="row" value={softness} onCommit={setSoftness} resetTo={0} range={SOFTNESS_RANGE} />
    </OpDialog>
  );
}
