import { useCallback, useMemo, useRef } from 'react';
import { CATEGORY_LABELS, ControlPanel, OpDialog, controlsFor, createDefaultEditValues, editKindOf, hasAnyChanges, useOpSession } from '@mat/imageops';
import { kindLabel, readMapPixels, type MapKind, type MapRecord, type MapsController } from '@mat/maps';
import type { ColorMode } from '@mat/storage';
import type { ImageopsSessions } from '../imageops/useImageopsSessions';
import { useBeforeAfterSources } from './useMapPictures';

interface FilterDialogProps {
  kind: MapKind;
  map: MapRecord; // the map as it was when the dialog opened: the session works on this working copy
  colorMode: ColorMode;
  controller: MapsController;
  readBlob(key: string): Promise<Blob | null>;
  openSession: ImageopsSessions['openFilter'];
  onClose(): void;
}

/** Imageops R9, R16-R19, R50: the filter of one map. Apply renders at S and commits one single-map edit; Cancel, or switching away, closes the session. */
export function FilterDialog({ kind, map, colorMode, controller, readBlob, openSession, onClose }: FilterDialogProps): React.JSX.Element | null {
  const editKind = editKindOf(kind);
  const start = useRef({ map, readBlob });
  const defaults = useMemo(() => createDefaultEditValues(editKind ?? 'albedo'), [editKind]);
  const isChanged = useCallback((values: Record<string, number>) => editKind !== null && hasAnyChanges(editKind, values), [editKind]);
  const open = useCallback(async () => {
    const pixels = await readMapPixels(await start.current.readBlob(start.current.map.workingKey));
    if (pixels === null || editKind === null) throw new Error('The map cannot be read.');
    return openSession(pixels, editKind);
  }, [openSession, editKind]);
  const op = useOpSession({ openSession: open, defaults, isChanged });
  const sources = useBeforeAfterSources(map.workingKey, readBlob, { src: op.previewUrl });
  if (editKind === null) return null;

  const label = kindLabel(kind, colorMode);
  const failed = op.status === 'failed' ? 'Could not start the edit: the map or the graphics card is unavailable.' : null;
  const apply = async (): Promise<void> => {
    if (await op.apply((image) => controller.applyEdits([{ kind, image }], 'Filter', false))) onClose();
  };

  return (
    <OpDialog
      title={`Filter ${label}`}
      sources={sources}
      canApply={op.canApply}
      applying={op.applying}
      error={failed ?? op.error}
      onReset={op.reset}
      onCancel={onClose}
      onApply={() => void apply()}
    >
      <ControlPanel controls={controlsFor(editKind)} categoryLabels={CATEGORY_LABELS} values={op.values} onChange={op.setValue} />
    </OpDialog>
  );
}
