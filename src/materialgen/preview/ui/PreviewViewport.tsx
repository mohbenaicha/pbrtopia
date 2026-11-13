import { useCallback, useEffect, useMemo, useState } from 'react';
import { useViewportSettings } from '@shared/shell';
import { DEFAULT_VIEWPORT_SETTINGS, ViewportCanvas, ViewportCorner, type Viewport } from '@shared/viewport';
import { withPendingMaps, type MapsState, type PendingMaps } from '@mat/maps';
import type { PaletteEntry } from '@mat/workerapi';
import { DEFAULT_PREVIEW_VALUES, type MaterialProjectStore, type PreviewValues } from '@mat/storage';
import type { PreviewShading } from '../math/flatViews';
import { adaptViewportForPreview } from './adaptViewportForPreview';
import { MaskDisplayControl } from './MaskDisplayControl';
import { MeshPicker } from './MeshPicker';
import { OpenImageButton } from './OpenImageButton';
import { PreviewSettingsPanel } from './PreviewSettingsPanel';
import { usePreviewMaps } from './usePreviewMaps';
import { usePreviewPrefs } from './usePreviewPrefs';
import { usePreviewScene } from './usePreviewScene';
import { usePreviewThumbnail } from './usePreviewThumbnail';
import { useToolViewRelease, type ToolView } from './useToolViewRelease';
import type { ToolLiveFeed } from './toolLiveFeed';
import { pickLiveTransform, useLiveToolFeed } from './useLiveToolTransform';
import { useViewAngleReport } from './useViewAngleReport';

export interface PreviewViewportProps {
  store: Pick<MaterialProjectStore, 'loadAppSettings' | 'saveAppSettings'>;
  mapsState: MapsState;
  readBlob: (key: string) => Promise<Blob | null>;
  values: PreviewValues; // per project (tiling and height)
  onValuesChange: (patch: Partial<PreviewValues>) => void;
  shading: PreviewShading; // session-only, not stored (R51); the selector is in the left panel
  thumbnail: PreviewThumbnailSink;
  masks: PreviewMasks;
  tool?: PreviewTool; // the transform an open Crop or Mirror puts on the maps (R58)
  pending?: PendingMaps; // pictures shown before they are saved (maps R71)
}

/** Preview R58, R59: the tool view applied to the maps, and what to tell the owner when a held view has been replaced by the committed maps. */
export interface PreviewTool {
  view: ToolView | null;
  onSettled: () => void;
  live?: ToolLiveFeed; // imageops R75: the ticks of a dragged setting, put on the scene once per frame without a render of the owner
  onViewAngle?: (degrees: number) => void; // imageops R72, R74: the turn of the picture in the view; present only while a plane picker is on screen (the picker follows it)
}

/** What the app hands the Material Masks icon and the overlay (R28, R40). */
export interface PreviewMasks {
  palette: readonly PaletteEntry[] | null; // from the masks record; null when the material has none
  overlay: boolean; // session-only switch
  onOverlayChange(on: boolean): void;
  highlight?: number | null; // masks R80: the label to draw alone while the pointer is over its swatch
  controls: React.ReactNode; // the Material Masks controls shown in the icon's popover under the opacity slider (masks R49); the app owns them
}

/** Where the project thumbnail goes (R54): written while `enabled`; the saver is handed out so closing the project can ask for it, and withdrawn when the preview goes. */
export interface PreviewThumbnailSink {
  enabled: boolean;
  save(jpeg: Blob): Promise<unknown>;
  onSaver(saver: (() => Promise<void>) | null): void;
}

const HINT = 'Drag to rotate, scroll to zoom'; // preview R21
const NO_TOOL: PreviewTool = { view: null, onSettled: () => undefined };
const NO_PENDING: PendingMaps = {};
const NO_REPORT = (): void => undefined;

/** The 3D preview of the open material (preview spec): the shared viewport without a model, one mesh in previewGroup, turned by dragging. */
export function PreviewViewport({ store, mapsState, readBlob, values, onValuesChange, shading, thumbnail, masks, tool = NO_TOOL, pending = NO_PENDING }: PreviewViewportProps): React.JSX.Element {
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsTarget = useMemo(() => (viewport === null ? null : adaptViewportForPreview(viewport)), [viewport]);
  const { settings, change } = useViewportSettings(store, settingsTarget);
  const { prefs, loaded: prefsLoaded, change: changePrefs, reset: resetPrefs } = usePreviewPrefs(store);
  const shownState = useMemo(() => withPendingMaps(mapsState, pending), [mapsState, pending]);
  const { maps, loaded, keys } = usePreviewMaps(shownState, readBlob, pending);
  const toolTransform = pickLiveTransform(tool.view, tool.live, useToolViewRelease(tool.view, keys, tool.onSettled));
  const maskOverlay = useMemo(() => ({ on: masks.overlay, opacity: prefs.maskOverlayOpacity, palette: masks.palette }), [masks.overlay, masks.palette, prefs.maskOverlayOpacity]);
  // the scene is built once the saved mesh and resolution are known, so a saved Plane never shows a Ball first
  const scene = usePreviewScene(prefsLoaded ? viewport : null, { prefs, values, mapAdjust: settings.mapAdjust, maps, shading, maskOverlay, maskHighlight: masks.highlight ?? null, toolTransform });
  useLiveToolFeed(scene, tool.view, tool.live);
  const { onViewAngle } = tool;
  useViewAngleReport(scene, onViewAngle !== undefined, onViewAngle ?? NO_REPORT); // the owner hands the reader over only while it wants the angle

  const capture = useMemo(() => (viewport === null ? null : () => viewport.captureThumbnail()), [viewport]);
  const saveThumbnail = usePreviewThumbnail({ scene, capture, maps, loaded, enabled: thumbnail.enabled, save: thumbnail.save });
  const { onSaver } = thumbnail;
  useEffect(() => {
    onSaver(saveThumbnail);
    return () => onSaver(null);
  }, [saveThumbnail, onSaver]);

  // R41: every preview value, the app-wide prefs and every viewport value go back to their defaults in one step.
  const resetAll = useCallback((): void => {
    change(DEFAULT_VIEWPORT_SETTINGS);
    resetPrefs();
    onValuesChange(DEFAULT_PREVIEW_VALUES);
  }, [change, resetPrefs, onValuesChange]);

  const overlay = (host: Viewport): React.JSX.Element => (
    <>
      <OpenImageButton shading={shading} mapsState={mapsState} readBlob={readBlob} />
      <ViewportCorner
        viewport={host}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
        settingsPanel={<PreviewSettingsPanel settings={settings} onChange={change} values={values} onValuesChange={onValuesChange} prefs={prefs} onPrefsChange={changePrefs} onReset={resetAll} />}
        showAxisGizmo={false}
        showCameraToggle={false}
        showGridToggle={false}
        onResetView={() => scene?.resetView()}
        moreButtons={
          <>
            <MeshPicker mesh={prefs.mesh} onChoose={(mesh) => changePrefs({ mesh })} />
            <MaskDisplayControl
              hasLabels={mapsState.maps.labels !== undefined}
              overlay={masks.overlay}
              onOverlayChange={masks.onOverlayChange}
              opacity={prefs.maskOverlayOpacity}
              onOpacityChange={(maskOverlayOpacity) => changePrefs({ maskOverlayOpacity })}
              controls={masks.controls}
            />
          </>
        }
      />
    </>
  );
  return <ViewportCanvas hint={HINT} onReady={setViewport} overlay={overlay} />;
}
