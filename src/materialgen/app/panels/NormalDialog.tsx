import { useCallback, useMemo, useRef } from 'react';
import { ControlPanel, OpDialog, createDefaultNormalValues, normalControls, useOpSession, type EditValues } from '@mat/imageops';
import { readMapPixels, type MapRecord, type MapsController } from '@mat/maps';
import type { ImageopsSessions } from '../imageops/useImageopsSessions';
import { useBeforeAfterSources } from './useMapPictures';

export interface NormalSourceMaps {
  height: MapRecord;
  normal?: MapRecord;
}

interface NormalDialogProps {
  maps: NormalSourceMaps;
  /** The parameters last used (normal-from-height R6), or the defaults. */
  initial: EditValues;
  controller: MapsController;
  readBlob(key: string): Promise<Blob | null>;
  openSession: ImageopsSessions['openNormal'];
  /** Called after Generate is stored: the parameters become the ones the tool and Regenerate start from. */
  onSettingsUsed(values: EditValues): void;
  onClose(): void;
}

const NORMAL_CATEGORY_LABELS = { surface: 'Parameters' } as const;

/** Normal-from-height R7: the Normal tool. One session on the height map's working copy at the time it opened; Generate commits the normal map derived from that copy. */
export function NormalDialog({ maps, initial, controller, readBlob, openSession, onSettingsUsed, onClose }: NormalDialogProps): React.JSX.Element {
  const start = useRef({ heightKey: maps.height.workingKey, readBlob });
  const defaults = useMemo(() => createDefaultNormalValues(), []);
  const open = useCallback(async () => {
    const pixels = await readMapPixels(await start.current.readBlob(start.current.heightKey));
    if (pixels === null) throw new Error('The map cannot be read.');
    return openSession(pixels);
  }, [openSession]);
  const op = useOpSession({ openSession: open, defaults, initial, previewOnOpen: true, isChanged: () => true }); // Generate needs no change from the defaults (R7)
  const shown = maps.normal ?? maps.height; // before the first normal map exists the left picture is the height map
  const sources = useBeforeAfterSources(shown.workingKey, readBlob, { src: op.previewUrl });
  const labelled = maps.normal === undefined ? sources.map((entry) => (entry.id === 'before' ? { ...entry, label: 'Height map' } : entry)) : sources;

  const generate = async (): Promise<void> => {
    const stored = await op.apply((image) => controller.applyEdits([{ kind: 'normal', image, derivedFrom: { kind: 'height', key: start.current.heightKey } }], 'Generate normal map', false)); // derived from the copy the session was opened on
    if (!stored) return;
    onSettingsUsed(op.values);
    onClose();
  };

  return (
    <OpDialog
      title="Generate normal map"
      sources={labelled}
      canApply={op.canApply}
      applying={op.applying}
      applyLabel="Generate"
      error={op.status === 'failed' ? 'Could not start the tool: the map is unavailable.' : op.error}
      onReset={op.reset}
      onCancel={onClose}
      onApply={() => void generate()}
    >
      <ControlPanel controls={normalControls} categoryLabels={NORMAL_CATEGORY_LABELS} values={op.values} onChange={op.setValue} />
    </OpDialog>
  );
}
