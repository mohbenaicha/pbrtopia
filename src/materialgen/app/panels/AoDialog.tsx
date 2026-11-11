import { useCallback, useMemo, useRef, useState } from 'react';
import { SegmentedControl } from '@shared/ui-kit';
import {
  ControlPanel, OpDialog, aoControlsFor, aoSourceFor, aoValuesFor, createDefaultAoValues, useOpSession,
  type AoSettings, type AoSource, type EditValues,
} from '@mat/imageops';
import { readMapPixels, type MapRecord, type MapsController } from '@mat/maps';
import type { ColorMode } from '@mat/storage';
import type { ImageopsSessions } from '../imageops/useImageopsSessions';
import { useBeforeAfterSources } from './useMapPictures';

export interface AoSourceMaps {
  height?: MapRecord;
  normal?: MapRecord;
  ao?: MapRecord;
}

interface AoDialogProps {
  maps: AoSourceMaps;
  settings: AoSettings;
  colorMode: ColorMode;
  controller: MapsController;
  readBlob(key: string): Promise<Blob | null>;
  openSession: ImageopsSessions['openAo'];
  /** Called after Generate is stored: the parameters become the ones the tool and Regenerate start from. */
  onSettingsUsed(source: AoSource, values: EditValues): void;
  onClose(): void;
}

const SOURCE_LABELS: Record<AoSource, string> = { height: 'Height', normal: 'Normal' };
const AO_CATEGORY_LABELS = { surface: 'Parameters' } as const;

interface AoSessionDialogProps extends Omit<AoDialogProps, 'maps' | 'settings'> {
  source: AoSource;
  sourceMap: MapRecord;
  aoMap: MapRecord | undefined;
  initial: EditValues;
  switcher: React.ReactNode;
}

/** One AO session on one source map: the dialog is made again when the source changes, so a session never changes its source image. */
function AoSessionDialog({ source, sourceMap, aoMap, initial, switcher, controller, readBlob, openSession, onSettingsUsed, onClose }: AoSessionDialogProps): React.JSX.Element {
  const start = useRef({ sourceKey: sourceMap.workingKey, readBlob });
  const defaults = useMemo(() => createDefaultAoValues(source), [source]);
  const open = useCallback(async () => {
    const pixels = await readMapPixels(await start.current.readBlob(start.current.sourceKey));
    if (pixels === null) throw new Error('The map cannot be read.');
    return openSession(pixels, source);
  }, [openSession, source]);
  const op = useOpSession({ openSession: open, defaults, initial, previewOnOpen: true, isChanged: () => true }); // Generate needs no change from the defaults (R43)
  const shown = aoMap ?? sourceMap; // before the first AO map exists the left picture is the map it is made from
  const sources = useBeforeAfterSources(shown.workingKey, readBlob, { src: op.previewUrl });
  const labelled = aoMap === undefined ? sources.map((entry) => (entry.id === 'before' ? { ...entry, label: `${SOURCE_LABELS[source]} map` } : entry)) : sources;

  const generate = async (): Promise<void> => {
    const stored = await op.apply((image) => controller.applyEdits([{ kind: 'ao', image, derivedFrom: { kind: source, key: start.current.sourceKey } }], 'Generate AO', false)); // derived from the copy the session was opened on
    if (!stored) return;
    onSettingsUsed(source, op.values);
    onClose();
  };

  return (
    <OpDialog
      title="Generate AO"
      sources={labelled}
      canApply={op.canApply}
      applying={op.applying}
      applyLabel="Generate"
      error={op.status === 'failed' ? 'Could not start the tool: the map or the graphics card is unavailable.' : op.error}
      onReset={op.reset}
      onCancel={onClose}
      onApply={() => void generate()}
    >
      {switcher}
      <ControlPanel controls={aoControlsFor(source)} categoryLabels={AO_CATEGORY_LABELS} values={op.values} onChange={op.setValue} />
    </OpDialog>
  );
}

/** Imageops R42, R43: the AO tool. The source toggle shows only when both a height and a normal map exist; changing it opens a new session on the other map. */
export function AoDialog({ maps, settings, ...rest }: AoDialogProps): React.JSX.Element | null {
  const [chosen, setChosen] = useState<AoSource | undefined>(settings.source);
  const source = aoSourceFor({ hasHeight: maps.height !== undefined, hasNormal: maps.normal !== undefined }, chosen);
  if (source === null) return null;
  const sourceMap = maps[source];
  if (sourceMap === undefined) return null;
  const both = maps.height !== undefined && maps.normal !== undefined;
  const switcher = both ? (
    <SegmentedControl
      label="AO source"
      options={[{ value: 'height', label: 'Height' }, { value: 'normal', label: 'Normal' }]}
      value={source}
      onChange={setChosen}
    />
  ) : null;
  return <AoSessionDialog key={source} source={source} sourceMap={sourceMap} aoMap={maps.ao} initial={aoValuesFor(settings, source)} switcher={switcher} {...rest} />;
}
