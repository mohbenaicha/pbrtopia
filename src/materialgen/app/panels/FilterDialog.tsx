import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RawRecord } from '@shared/projects';
import { CATEGORY_LABELS, ControlPanel, MAX_PREVIEW_SIZE, OpDialog, blendByCoverage, controlsFor, createDefaultEditValues, downsampleBox, editKindOf, hasAnyChanges, useOpSession, type PixelImage } from '@mat/imageops';
import { pixelsToPictureUrl } from '@mat/imageops/ui/pixelPictureUrl';
import { kindLabel, readMapPixels, type MapKind, type MapRecord, type MapsController } from '@mat/maps';
import { MaskSwatchGrid } from '@mat/masks';
import type { ColorMode } from '@mat/storage';
import type { ImageopsSessions } from '../imageops/useImageopsSessions';
import { useFilterMaskScope } from './useFilterMaskScope';
import { useBeforeAfterSources } from './useMapPictures';

interface FilterDialogProps {
  kind: MapKind;
  map: MapRecord; // the map as it was when the dialog opened: the session works on this working copy
  colorMode: ColorMode;
  controller: MapsController;
  readBlob(key: string): Promise<Blob | null>;
  openSession: ImageopsSessions['openFilter'];
  onClose(): void;
  masksRecord?: RawRecord | undefined; // the project's masks, for the swatches that scope the edit (R78)
  labelsKey?: string | null; // the labels map's working copy
  albedoKey?: string | null; // the albedo's (or diffuse's) working copy: a normal map's colour mixin reads it, and is not offered without it (R82, R84)
}

const MASK_HINT = 'Edit only the selected masks';

/**
 * Imageops R9, R16-R19, R50, R78-R81: the filter of one map. Apply renders at S and commits one single-map edit; Cancel, or switching away, closes the session.
 * With masks selected, only the selected components are edited: each render is blended with the original through the mask coverage (R79).
 */
export function FilterDialog({ kind, map, colorMode, controller, readBlob, openSession, onClose, masksRecord, labelsKey = null, albedoKey = null }: FilterDialogProps): React.JSX.Element | null {
  const editKind = editKindOf(kind);
  const start = useRef({ map, readBlob });
  const original = useRef<{ full: PixelImage; preview: PixelImage } | null>(null); // the map as it was read: at S for Apply, at P for the preview
  const size = map.width;
  const previewSize = Math.min(size, MAX_PREVIEW_SIZE);
  const scope = useFilterMaskScope({ masksRecord, labelsKey, size, previewSize, readBlob });
  const previewCoverage = useRef(scope.previewCoverage);
  previewCoverage.current = scope.previewCoverage;
  const defaults = useMemo(() => createDefaultEditValues(editKind ?? 'albedo'), [editKind]);
  const isChanged = useCallback((values: Record<string, number>) => editKind !== null && hasAnyChanges(editKind, values), [editKind]);
  const open = useCallback(async () => {
    const pixels = await readMapPixels(await start.current.readBlob(start.current.map.workingKey));
    if (pixels === null || editKind === null) throw new Error('The map cannot be read.');
    original.current = { full: pixels, preview: downsampleBox(pixels, Math.max(1, Math.round(pixels.width / previewSize))) };
    const albedo = editKind === 'normal' && albedoKey !== null ? await readMapPixels(await start.current.readBlob(albedoKey)) : null; // R84: read once, dropped once uploaded
    return albedo === null ? openSession(pixels, editKind) : openSession(pixels, editKind, albedo);
  }, [openSession, editKind, previewSize, albedoKey]);
  const controls = useMemo(() => (editKind === null ? [] : controlsFor(editKind).filter((control) => control.id !== 'albedoMix' || albedoKey !== null)), [editKind, albedoKey]); // R82
  const encodePreview = useCallback(async (image: PixelImage): Promise<string> => {
    const coverage = previewCoverage.current;
    const base = original.current?.preview;
    return pixelsToPictureUrl(coverage !== null && base !== undefined ? blendByCoverage(base, image, coverage) : image);
  }, []);
  const op = useOpSession({ openSession: open, defaults, isChanged, encodePreview });
  const changed = useRef(false);
  changed.current = op.canApply;
  const { refreshPreview } = op;
  useEffect(() => {
    if (changed.current) refreshPreview(); // R79: another selection is another preview (a click, never a drag)
  }, [scope.previewCoverage, refreshPreview]);
  const sources = useBeforeAfterSources(map.workingKey, readBlob, { src: op.previewUrl });
  if (editKind === null) return null;

  const label = kindLabel(kind, colorMode);
  const failed = op.status === 'failed' ? 'Could not start the edit: the map or the graphics card is unavailable.' : null;
  const apply = async (): Promise<void> => {
    const commit = async (image: PixelImage): Promise<boolean> => {
      const coverage = scope.finalCoverage();
      const base = original.current?.full;
      return controller.applyEdits([{ kind, image: coverage !== null && base !== undefined ? blendByCoverage(base, image, coverage) : image }], 'Filter', false);
    };
    if (await op.apply(commit)) onClose();
  };

  return (
    <OpDialog
      title={`Filter ${label}`}
      sources={sources}
      canApply={op.canApply}
      applying={op.applying}
      error={failed ?? op.error}
      scope={scope.swatches === null ? null : <MaskSwatchGrid rows={scope.swatches.rows} palette={scope.swatches.palette} selected={scope.selected} onSelect={scope.toggle} onHighlight={scope.highlight} hint={MASK_HINT} />}
      overlay={scope.overlay}
      onReset={op.reset}
      onCancel={onClose}
      onApply={() => void apply()}
    >
      <ControlPanel controls={controls}categoryLabels={CATEGORY_LABELS} values={op.values} onChange={op.setValue} />
    </OpDialog>
  );
}
