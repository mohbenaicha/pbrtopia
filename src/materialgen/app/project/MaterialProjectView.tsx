import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { acquireProjectLock } from '@shared/projects';
import { AddonsButton } from '../addons/AddonsButton';
import { AppShell, TopBar, rememberOpenProject, usePanelWidths, useProjectLock, useStorageWarning } from '@shared/shell';
import { LoadingOverlay } from '@shared/ui-kit';
import { parseMasksRecord } from '@mat/masks';
import { PreviewViewport, createToolLiveFeed, type PreviewMasks, type PreviewShading, type PreviewThumbnailSink, type PreviewTool, type ToolView } from '@mat/preview';
import { DEFAULT_PREVIEW_VALUES, type MaterialProjectStore, type PreviewValues } from '@mat/storage';
import { APP_ID } from '../appIdentity';
import { useMasksPackagePrompt } from '../masksPackage/useMasksPackagePrompt';
import { createGpuResizer } from '../imageops/createGpuResizer';
import { useImageopsSessions } from '../imageops/useImageopsSessions';
import { ExportSection, exportUnavailableReason } from '../panels/export/ExportSection';
import { useExportDialog } from '../panels/export/useExportDialog';
import { MaterialGeneratePanel } from '../panels/MaterialGeneratePanel';
import { MaterialMapsPanel } from '../panels/MaterialMapsPanel';
import { ToolLiveContext } from '../panels/tools/ToolLiveContext';
import { ViewAngleContext, useViewAngleWatched } from '../panels/tools/ViewAngleContext';
import { createViewAngleStore } from '../panels/tools/viewAngleStore';
import { loadBaseMaterials } from '../panels/masks/loadBaseMaterials';
import { describeMasksModel } from '../panels/masks/masksModelControls';
import { MasksControls } from '../panels/masks/MasksControls';
import { MaterialSetupOverlay } from '../panels/setup/MaterialSetupOverlay';
import { useMaterialGeneration } from './useMaterialGeneration';
import { useLeaveMaterialProject } from './useLeaveMaterialProject';
import { useMaterialExport } from './materialZipTransfer';
import { useMaterialMaps } from './useMaterialMaps';
import { useMaterialProject } from './useMaterialProject';
import { useMaskView } from './useMaskView';
import './MaterialProjectView.css';

export type MaterialViewStore = Pick<
  MaterialProjectStore,
  'loadProject' | 'saveProject' | 'renameProject' | 'sweepOrphanBlobs' | 'readBlob' | 'writeBlob' | 'deleteBlob' | 'loadThumbnail' | 'saveThumbnail' | 'saveAppSettings' | 'loadAppSettings' | 'estimateStorage'
>;

const acquireMaterialLock = (projectId: string) => acquireProjectLock(projectId, undefined, APP_ID); // app R32: the lock name derives from the app id

/** An open project (materialgen app R10-R14): the shell around the preview viewport, the left panel of settings and the right panel of map slots. */
export function MaterialProjectView({ store, projectId }: { store: MaterialViewStore; projectId: string }): React.JSX.Element {
  const panels = usePanelWidths(store);
  const storage = useStorageWarning(store);
  const lock = useProjectLock(projectId, acquireMaterialLock);
  const canWrite = lock === 'held'; // another tab holding the project makes this one read-only (R13)
  const project = useMaterialProject({ store, projectId, canWrite, onSaveFailure: (code) => code === 'quota-exceeded' && storage.reportFull() });
  const { record } = project;
  const sessions = useImageopsSessions();
  const resize = useMemo(() => createGpuResizer(sessions.geometry), [sessions]);
  const { state: mapsState, controller: maps } = useMaterialMaps({ store, projectId, record, canWrite, project, resize });
  const readBlob = useCallback((key: string) => store.readBlob(projectId, key), [store, projectId]);
  const thumbnailSaver = useRef<(() => Promise<void>) | null>(null); // the preview hands it out; closing the project calls it (preview R54)
  const saveThumbnail = useCallback(async (): Promise<void> => void (await thumbnailSaver.current?.()), []);
  const leave = useLeaveMaterialProject({ store, flush: project.flush, saveThumbnail });
  const thumbnail = useMemo<PreviewThumbnailSink>(
    () => ({ enabled: canWrite, save: (jpeg) => store.saveThumbnail(projectId, jpeg), onSaver: (saver) => void (thumbnailSaver.current = saver) }),
    [canWrite, store, projectId],
  );
  const projectExport = useMaterialExport(store, record === null ? null : { id: projectId, name: record.name }, project.flush); // the zip backup (app R37), offered by the storage warning
  const exportDialog = useExportDialog({ projectName: record?.name ?? '', colorMode: record?.colorMode ?? 'albedo', state: mapsState, preview: record?.preview ?? DEFAULT_PREVIEW_VALUES, masksRecord: record?.masks, readBlob }); // opened from the top bar (app R11)

  const [shading, setShading] = useState<PreviewShading>('lit'); // the selector is at the top of the left panel, the preview draws it (preview R51)
  const [toolView, setToolView] = useState<ToolView | null>(null); // the transform an open Crop or Mirror puts on the maps in the viewport (imageops R53, preview R58)
  const releaseToolView = useCallback(() => setToolView(null), []);
  const viewAngle = useMemo(createViewAngleStore, []); // the turn of the picture in the viewport, for the plane picker of an open Crop or Mirror (imageops R72)
  const pickerOpen = useViewAngleWatched(viewAngle); // the viewport reads the angle only while a plane picker is on screen (R74)
  const toolLive = useMemo(() => createToolLiveFeed(), []); // the ticks of a dragged tool setting, past this view's state (imageops R75)
  const previewTool = useMemo<PreviewTool>(
    () => ({ view: toolView, onSettled: releaseToolView, live: toolLive, ...(pickerOpen ? { onViewAngle: viewAngle.set } : {}) }),
    [toolView, releaseToolView, toolLive, viewAngle, pickerOpen],
  );
  const maskView = useMaskView();
  const maskPalette = useMemo(() => (record === null ? null : (parseMasksRecord(record.masks)?.palette ?? null)), [record?.masks]);

  const { edit } = project;
  const changePreviewValues = useCallback((patch: Partial<PreviewValues>) => edit((current) => ({ ...current, preview: { ...current.preview, ...patch } })), [edit]);

  useEffect(() => {
    void rememberOpenProject(store, projectId);
  }, [store, projectId]);

  const masksPackage = useMasksPackagePrompt(); // masks-package R6: asked before a metal-roughness run, its dialog drawn at the end of the shell
  const generation = useMaterialGeneration({ store, projectId, record, canWrite, project, mapsState, maps, beforeDecomposition: masksPackage.ensure });
  // The Material Masks controls live in the viewport's Mask display popover (masks R48); the popover builds them only while it is open.
  const previewMasks: PreviewMasks = {
    palette: maskPalette,
    overlay: maskView.overlay,
    onOverlayChange: maskView.onOverlay,
    highlight: maskView.highlight,
    controls: (
      <MasksControls
        onHighlight={maskView.onHighlight}
        state={mapsState}
        masksRecord={record?.masks}
        canWrite={canWrite}
        controller={maps}
        readBlob={readBlob}
        loadTable={loadBaseMaterials}
        model={describeMasksModel({ generation, hasAlbedo: (mapsState.maps.albedo ?? mapsState.maps.diffuse) !== undefined })}
      />
    ),
  };
  const [setupOpen, setSetupOpen] = useState(false); // generation R10: the Custom setup overlay
  useEffect(() => {
    if (!canWrite) setSetupOpen(false); // another tab took the project: nothing is left to confirm into
  }, [canWrite]);

  return (
    <AppShell
      panels={panels}
      locked={setupOpen}
      rightLocked={setupOpen}
      topBar={
        <TopBar
          projectName={record?.name ?? null}
          fallbackTitle={APP_ID}
          onOpenProjects={() => void leave.showProjectList()}
          onOpenSettings={() => void leave.showSettings()}
          settingsDisabledReason={null}
          exportLabel="Export material"
          onExportProject={exportDialog.show}
          exporting={false}
          exportDisabledReason={record === null ? 'The project is still opening.' : exportUnavailableReason(exportDialog)}
          extraActions={<AddonsButton />}
        />
      }
      left={
        record === null ? null : (
          <ViewAngleContext.Provider value={viewAngle}>
          <ToolLiveContext.Provider value={toolLive}>
          <MaterialMapsPanel
            shading={shading}
            onShadingChange={setShading}
            mapsState={mapsState}
            maps={maps}
            readBlob={readBlob}
            sessions={sessions}
            aoParams={record.aoParams}
            onAoParamsChange={(next) => project.edit((current) => ({ ...current, aoParams: next }))}
            colorMode={record.colorMode}
            canWrite={canWrite}
            onToolViewChange={setToolView}
            masksRecord={record.masks}
          >
            <ExportSection dialog={exportDialog} />
          </MaterialMapsPanel>
          </ToolLiveContext.Provider>
          </ViewAngleContext.Provider>
        )
      }
      viewport={
        <div className="material-viewport" data-testid="material-viewport">
          {project.loading && <LoadingOverlay label="Opening project" />}
          {project.error !== null && <p className="material-viewport__message" role="alert">{project.error}</p>}
          {record !== null && <PreviewViewport store={store} mapsState={mapsState} readBlob={readBlob} values={record.preview} onValuesChange={changePreviewValues} shading={shading} thumbnail={thumbnail} masks={previewMasks} tool={previewTool} pending={maps.pending} />}
          {record !== null && setupOpen && <MaterialSetupOverlay generation={generation} colorMode={record.colorMode} onClose={() => setSetupOpen(false)} />}
          {masksPackage.dialog}
        </div>
      }
      right={
        record === null ? null : (
          <MaterialGeneratePanel
            record={record}
            canWrite={canWrite}
            readOnly={lock === 'read-only'}
            generation={generation}
            onEdit={project.edit}
            onResizeMaps={(size) => void maps.changeSize(size)}
            resizing={maps.busy.has('size')}
            onCustomSetup={() => setSetupOpen(true)}
            storage={storage}
            onExportProject={() => void projectExport.start()}
            exporting={projectExport.exporting}
            exportError={projectExport.error}
            exportDisabledReason={null}
          />
        )
      }
    />
  );
}
