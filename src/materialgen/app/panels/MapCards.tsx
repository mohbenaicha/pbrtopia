import { useEffect, useMemo, useState } from 'react';
import type { RawRecord } from '@shared/projects';
import { ConfirmDialog, Disclosure, ImageViewer } from '@shared/ui-kit';
import { aoSourceFor, aoValuesFor, readAoSettings, writeAoSettings, type AoSource, type EditValues } from '@mat/imageops';
import { MapCard, buildCardModel, kindLabel, readMapPixels, type MapCardActions, type MapKind, type MapRecord, type MapsController, type MapsState } from '@mat/maps';
import type { ColorMode, MaterialRecord } from '@mat/storage';
import { regenerateAo } from '../imageops/regenerateAo';
import type { ImageopsSessions } from '../imageops/useImageopsSessions';
import { AoCardActions } from './AoCardActions';
import { AoDialog } from './AoDialog';
import { FilterDialog } from './FilterDialog';
import { READ_ONLY_REASON } from './generateReason';
import { CARD_SLOTS } from './slotCards';
import { useGeometryTools, type HeldToolView } from './tools/useGeometryTools';
import { usePaintTool } from './tools/usePaintTool';
import { useStoredPicture } from './useMapPictures';
import { useUndoShortcut } from './useUndoShortcut';

interface MapCardsProps {
  state: MapsState;
  colorMode: ColorMode;
  canWrite: boolean;
  controller: MapsController;
  readBlob(key: string): Promise<Blob | null>;
  /** Opens imageops sessions on working copies (imageops R9); the filter and AO dialogs are built on them. */
  sessions: ImageopsSessions;
  /** The AO parameters last used, kept in the record (imageops R43), and how a use of the tool changes them. */
  aoParams: MaterialRecord['aoParams'];
  onAoParamsChange(next: NonNullable<MaterialRecord['aoParams']>): void;
  /** Gives the viewport the picture an open Crop or Mirror is drawing, or null to show the maps again (imageops R53, R59). */
  onToolViewChange(view: HeldToolView | null): void;
  /** The project's masks record, for the swatches that scope a filter (imageops R78). */
  masksRecord?: RawRecord | undefined;
}

/** Maps R46: the shared zoomable viewer on the map's current picture, and nothing else. */
function MapViewer({ kind, map, size, colorMode, readBlob, onDownload, onClose }: { kind: MapKind; map: MapRecord; size: number | null; colorMode: ColorMode; readBlob: MapCardsProps['readBlob']; onDownload(): void; onClose(): void }): React.JSX.Element {
  const picture = useStoredPicture(map.workingKey, readBlob);
  const title = kindLabel(kind, colorMode);
  return <ImageViewer title={title} src={picture.src} failed={picture.failed} details={size === null ? [] : [`${size} x ${size}`]} onDownload={onDownload} downloadLabel={`Download ${title}`} onClose={onClose} />;
}

/** Materialgen maps R34, R44-R49 and imageops R9, R17: the five slot cards with Clear's confirmation, the viewer, the filter dialog and the controller's message. */
export function MapCards({ state, colorMode, canWrite, controller, readBlob, sessions, aoParams, onAoParamsChange, onToolViewChange, masksRecord }: MapCardsProps): React.JSX.Element {
  const [mapsOpen, setMapsOpen] = useState(true); // the grid of the five slots, open at first so the drop zones are in reach
  const [clearing, setClearing] = useState<MapKind | null>(null);
  const [viewing, setViewing] = useState<MapKind | null>(null);
  const [filtering, setFiltering] = useState<{ kind: MapKind; map: MapRecord } | null>(null);
  const [aoToolOpen, setAoToolOpen] = useState(false);
  const [geometryToolOpen, setGeometryToolOpen] = useState(false);
  const [paintOpen, setPaintOpen] = useState(false); // the splat painter's session (compositing R2): exclusive with every other op
  const [working, setWorking] = useState(false); // Swap diagonals or Regenerate is running: they have no dialog but are ops too
  const dialogOpen = filtering !== null || aoToolOpen;
  const opOpen = dialogOpen || geometryToolOpen || paintOpen || working; // imageops R9: one op at a time
  const exclusive = async (work: () => Promise<void>): Promise<void> => {
    setWorking(true);
    try {
      await work();
    } finally {
      setWorking(false);
    }
  };
  const aoSettings = useMemo(() => readAoSettings(aoParams), [aoParams]);
  const aoSource = aoSourceFor({ hasHeight: state.maps.height !== undefined, hasNormal: state.maps.normal !== undefined }, aoSettings.source);
  const regenerate = async (): Promise<void> => {
    const sourceMap = aoSource === null ? undefined : state.maps[aoSource];
    if (aoSource === null || sourceMap === undefined) return;
    try {
      const result = await regenerateAo({
        source: aoSource,
        sourceKey: sourceMap.workingKey,
        sourceLabel: kindLabel(aoSource, colorMode),
        values: aoValuesFor(aoSettings, aoSource),
        ports: { readPixels: async (key) => readMapPixels(await readBlob(key)), openAo: sessions.openAo, applyEdits: controller.applyEdits },
      });
      if (!result.ok && result.message !== undefined) controller.refuse(result.message);
    } catch {
      controller.refuse('Could not regenerate the AO map. Nothing changed.'); // the file could not be read or saved
    }
  };
  const rememberAo = (source: AoSource, values: EditValues): void => onAoParamsChange(writeAoSettings(aoParams, source, values));
  const { busy, message } = controller;
  useUndoShortcut({ state, colorMode, canWrite, busy: busy.size > 0 || opOpen, undo: (kinds) => void controller.undo(kinds) });
  const geometryTools = useGeometryTools({
    state, colorMode, canWrite, readOnlyReason: READ_ONLY_REASON, opOpen: dialogOpen || working || paintOpen, busy: busy.size > 0, exclusive,
    geometry: sessions.geometry, controller, readBlob, onToolViewChange,
    onToolOpenChange: (open) => {
      setGeometryToolOpen(open);
      if (open) setMapsOpen(true); // R52: the panel is in the Maps section, so it must be in view
    },
  });
  const paintTool = usePaintTool({
    state, canWrite, readOnlyReason: READ_ONLY_REASON, opOpen: dialogOpen || working || geometryToolOpen, busy: busy.size > 0, controller, readBlob,
    onToolOpenChange: (open) => {
      setPaintOpen(open);
      if (open) setMapsOpen(true); // the panel is in the Maps section, so it must be in view
    },
  });
  const aoButtons = (
    <AoCardActions
      hasSource={aoSource !== null}
      canWrite={canWrite}
      readOnlyReason={READ_ONLY_REASON}
      opOpen={opOpen}
      busy={busy.has('ao') || busy.has('size')}
      onOpenTool={() => setAoToolOpen(true)}
      onRegenerate={() => exclusive(regenerate)}
    />
  );
  const viewedMap = viewing === null ? undefined : state.maps[viewing];
  const viewedMapGone = viewing !== null && viewedMap === undefined;
  useEffect(() => {
    if (viewedMapGone) setViewing(null); // the map was cleared while its picture was open
  }, [viewedMapGone]);

  const actions = useMemo<MapCardActions>(
    () => ({
      dropFiles: (kind, files) => void controller.dropFiles(kind, files),
      undo: (kinds) => void controller.undo(kinds),
      restoreOriginal: (kind) => void controller.restoreOriginal(kind),
      requestClear: setClearing,
      view: setViewing,
      filter: (kind) => {
        const map = state.maps[kind];
        if (map !== undefined) setFiltering({ kind, map });
      },
      download: (kind) => void controller.download(kind),
      refuseDrop: controller.refuse,
    }),
    [controller, state.maps],
  );

  return (
    <>
      {message !== null && (
        <p className={`map-message map-message--${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>
          {message.text}{' '}
          <button type="button" className="map-message__dismiss" onClick={controller.dismissMessage}>Dismiss</button>
        </p>
      )}
      <Disclosure title="Maps" open={mapsOpen} onOpenChange={setMapsOpen} keepMounted actions={<>{geometryTools.buttons}{paintTool.button}</>}>
        {geometryTools.panel ?? paintTool.panel ?? (
          <div className="map-grid">
            {CARD_SLOTS.map((slot) => (
              <MapCard
                key={slot}
                model={buildCardModel(state, slot, colorMode)}
                canWrite={canWrite}
                opOpen={opOpen}
                readOnlyReason={READ_ONLY_REASON}
                isBusy={(kind) => busy.has(kind) || busy.has('size')}
                readBlob={readBlob}
                actions={actions}
                extras={slot === 'occlusion' ? { ao: aoButtons } : {}}
              />
            ))}
          </div>
        )}
      </Disclosure>
      {paintTool.overlays}
      <ConfirmDialog
        open={clearing !== null}
        title={clearing === null ? 'Clear' : `Clear ${kindLabel(clearing, colorMode)}?`}
        confirmLabel="Clear"
        busy={false}
        onCancel={() => setClearing(null)}
        onConfirm={() => {
          if (clearing !== null) void controller.clear(clearing);
          setClearing(null);
        }}
      >
        <p>The original is deleted and cannot be restored.</p>
      </ConfirmDialog>
      {viewing !== null && viewedMap !== undefined && <MapViewer kind={viewing} map={viewedMap} size={state.size} colorMode={colorMode} readBlob={readBlob} onDownload={() => void controller.download(viewing)} onClose={() => setViewing(null)} />}
      {filtering !== null && (
        <FilterDialog kind={filtering.kind} map={filtering.map} colorMode={colorMode} controller={controller} readBlob={readBlob} openSession={sessions.openFilter} onClose={() => setFiltering(null)} masksRecord={masksRecord} labelsKey={state.maps.labels?.workingKey ?? null} albedoKey={(state.maps.albedo ?? state.maps.diffuse)?.workingKey ?? null} />
      )}
      {aoToolOpen && (
        <AoDialog
          maps={{ ...(state.maps.height ? { height: state.maps.height } : {}), ...(state.maps.normal ? { normal: state.maps.normal } : {}), ...(state.maps.ao ? { ao: state.maps.ao } : {}) }}
          settings={aoSettings}
          colorMode={colorMode}
          controller={controller}
          readBlob={readBlob}
          openSession={sessions.openAo}
          onSettingsUsed={rememberAo}
          onClose={() => setAoToolOpen(false)}
        />
      )}
    </>
  );
}
