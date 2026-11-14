import { useEffect, useRef, useState } from 'react';
import { useStore, type StoreApi } from 'zustand';
import { Icon, IconButton, Tabs, Tooltip } from '../../ui-kit';
import { listAtlasSizes } from '../catalog/atlasSizes';
import { optionsForModel } from '../catalog/optionsForModel';
import { countImages } from '../custom/planEditing';
import { buildPanelEnhancerKey, isSameEnhancerKey } from '../enhancerSnapshot';
import { describeGenerateAvailability } from '../generateAvailability';
import { findCatalogModel, generateStore, type GenerateState, type ReferenceImage } from '../generateStore';
import { runLogStore, type RunLogState } from '../runLogStore';
import { AdditionalSettings } from './AdditionalSettings';
import { AtlasPreviewViewer } from './AtlasPreviewViewer';
import { ChannelToggle } from './ChannelToggle';
import { DebugTab } from './DebugTab';
import { EnhancedPromptNotice } from './EnhancedPromptNotice';
import { GenerateButton } from './GenerateButton';
import { ModelSelect } from './ModelSelect';
import { ProgressSteps } from './ProgressSteps';
import { QualitySelect } from './QualitySelect';
import { readImageFile } from './readImageFile';
import { ReferenceStrip } from './ReferenceStrip';
import { ResolutionSelect } from './ResolutionSelect';
import { RunErrorBlock } from './RunErrorBlock';
import { UnwrapStatusBlock } from './UnwrapStatusBlock';
import { UvOptionsDialog, type UvOptions } from './UvOptionsDialog';
import './GeneratePanel.css';

type PanelTab = 'generate' | 'debug';

interface GeneratePanelProps {
  projectId: string; // whose run log the Debug tab shows
  onGenerate: () => void;
  onGenerateUv: (options: UvOptions) => void;
  onCancel: () => void; // Cancel in the step list (R10)
  onRetry: () => void; // Retry in the error block (R9)
  onPreviewAtlas: () => Promise<{ ok: true; value: Blob } | { ok: false; error: string }>; // the eye button (R38): the atlas of the current settings, or why it could not be made
  onSetUpCustom?: () => void; // the gear beside Generate (custom R1): opens the setup overlay
  setupLocked?: boolean; // the setup overlay is open (custom R30): everything but Additional settings is inert
  onKeepWithout?: () => void; // Keep without image N in the error block (custom R29)
  uvNotice?: string; // shown in the Generate UV dialog (mesh edit R32)
  store?: StoreApi<GenerateState>;
  logStore?: StoreApi<RunLogState>;
  readImageFile?: (file: File) => Promise<ReferenceImage>;
  today?: string; // YYYY-MM-DD; defaults to the current date
}

// R38: why the atlas cannot be previewed now, or null.
function describePreviewBlock(state: GenerateState): string | null {
  if (state.status === 'running') return 'A run is in progress.';
  if (!state.hasModel) return 'Open a project with a model first.';
  if (!state.hasUvs) return 'The model has no UVs yet.';
  return null;
}

// Resolves after the browser has drawn the next frame (a task queued from inside a frame callback runs after that frame is painted).
const afterNextPaint = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

const carriesFiles = (event: React.DragEvent): boolean => Array.from(event.dataTransfer.types).includes('Files');

// R1, R23: the Generate panel: a Generate tab (prompt, references, channel, model, resolution, quality, Generate) and a Debug tab (the run log).
// The handlers run the flows (G9, G10); this panel only shows state and reports clicks. Both tabs stay mounted so a visit to the other loses nothing.
export function GeneratePanel({ projectId, onGenerate, onGenerateUv, onCancel, onRetry, onPreviewAtlas, onSetUpCustom, setupLocked = false, onKeepWithout, uvNotice, store = generateStore, logStore = runLogStore, readImageFile: readFile = readImageFile, today = new Date().toISOString().slice(0, 10) }: GeneratePanelProps): React.JSX.Element {
  const state = useStore(store);
  const records = useStore(logStore, (log) => log.records);
  const activeId = useStore(logStore, (log) => log.activeId);
  const [tab, setTab] = useState<PanelTab>('generate');
  const [reveal, setReveal] = useState<{ id: string | null; count: number }>({ id: null, count: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  const [uvDialogOpen, setUvDialogOpen] = useState(false);
  const [dropTarget, setDropTarget] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewPng, setPreviewPng] = useState<Blob | null>(null);
  const mounted = useRef(true);
  const model = findCatalogModel(state.catalog, state.provider, state.modelId);
  const options = model === null ? { resolutions: [], qualityLevels: [] } : optionsForModel(model, state.maxTextureSize);
  const panelKey = state.enhancerSnapshot === null || state.status === 'running' ? null : buildPanelEnhancerKey(state);
  const reusesEnhancedPrompt = state.enhancerSnapshot !== null && panelKey !== null && isSameEnhancerKey(state.enhancerSnapshot.key, panelKey); // R41

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // A refusal belongs to the model it was made under.
  useEffect(() => setNotice(null), [state.provider, state.modelId]);
  // R23: a failed run shows its error on the Generate tab.
  useEffect(() => {
    if (state.status === 'failed') setTab('generate');
  }, [state.status]);

  // R27: the step list points at the latest run's row, when that row is this project's.
  const activeRow = records.find((record) => record.id === activeId && record.projectId === projectId);
  const viewLog = activeRow === undefined ? undefined : () => {
    setReveal((previous) => ({ id: activeRow.id, count: previous.count + 1 }));
    setTab('debug');
  };

  const addFiles = async (files: File[]): Promise<void> => {
    const settled = await Promise.allSettled(files.map((file) => readFile(file)));
    if (!mounted.current) return;
    const images: ReferenceImage[] = [];
    const unreadable: string[] = [];
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') images.push(result.value);
      else unreadable.push(files[index]?.name ?? 'a file');
    });
    const { refused } = store.getState().addReferences(images);
    const now = store.getState();
    const total = findCatalogModel(now.catalog, now.provider, now.modelId)?.maxReferenceImages; // the model chosen now, as the store used
    const messages = [
      unreadable.length > 0 ? `Could not read as an image: ${unreadable.join(', ')}.` : '',
      refused > 0 && total !== undefined ? `This model takes at most ${total} images in total and one is the atlas, so up to ${total - 1} references.` : '',
    ].filter((message) => message !== '');
    setNotice(messages.length > 0 ? messages.join(' ') : null);
  };

  // R38: asks the app for the atlas of the current settings and shows it; a failure is the panel notice, not a run error.
  const previewAtlas = async (): Promise<void> => {
    if (previewing) return;
    setPreviewing(true);
    store.getState().setNotice(null);
    await afterNextPaint(); // the capture holds the main thread for a while: the busy state must be on screen first
    const outcome = await onPreviewAtlas();
    if (!mounted.current) return;
    setPreviewing(false);
    if (outcome.ok) setPreviewPng(outcome.value);
    else store.getState().setNotice(outcome.error);
  };

  return (
    <section className="generate-panel" aria-label="Generate">
      <div className="generate-panel__locked" inert={setupLocked}>
        <Tabs
          label="Generate panel"
          tabs={[{ value: 'generate', label: 'Generate' }, { value: 'debug', label: 'Debug', icon: 'bug', iconOnly: true }]}
          value={tab}
          onChange={setTab}
        />
      </div>
      <div className="generate-panel__page" role="tabpanel" aria-label="Generate fields" hidden={tab !== 'generate'}>
        <div className="generate-panel__locked" inert={setupLocked}>
          <label className="generate-panel__field">
            <Tooltip heading="Prompt" text="Describes the texture the image model should paint."><span className="generate-panel__label">Prompt</span></Tooltip>
            <textarea
              className="generate-panel__prompt"
              rows={10}
              value={state.prompt}
              data-drop-target={dropTarget ? '' : undefined}
              onChange={(event) => state.setPrompt(event.target.value)}
              onDragEnter={(event) => carriesFiles(event) && setDropTarget(true)}
              onDragOver={(event) => {
                if (carriesFiles(event)) event.preventDefault(); // without this the browser refuses the drop
              }}
              onDragLeave={() => setDropTarget(false)}
              onDrop={(event) => {
                setDropTarget(false);
                const files = Array.from(event.dataTransfer.files);
                if (files.length === 0) return; // selected text dropped in: the field handles it
                event.preventDefault();
                void addFiles(files);
              }}
            />
          </label>
          {reusesEnhancedPrompt && <EnhancedPromptNotice onEnhanceAgain={() => state.setEnhancerSnapshot(null)} />}
          <ReferenceStrip
            references={state.references}
            notice={notice}
            onFiles={(files) => void addFiles(files)}
            onRemove={state.removeReference}
          />
          <ChannelToggle />
          {state.mode === 'standard' && (
            <>
              <ModelSelect catalog={state.catalog} hasKey={state.hasKey} provider={state.provider} modelId={state.modelId} today={today} onSelect={state.selectModel} />
              <ResolutionSelect options={options.resolutions} experimental={model?.experimentalResolutions ?? []} value={state.resolutionKey} onChange={state.setResolution} />
              <QualitySelect levels={options.qualityLevels} value={state.quality} onChange={state.setQuality} />
            </>
          )}
        </div>
        <AdditionalSettings
          atlasSizes={listAtlasSizes(state.maxTextureSize)}
          atlasKey={state.atlasKey}
          onAtlasKeyChange={state.setAtlasKey}
          atlasRender={state.atlasRender}
          onAtlasRenderChange={state.setAtlasRender}
          tileBorder={state.tileBorder}
          onTileBorderChange={state.setTileBorder}
          previewing={previewing}
          previewBlockedReason={describePreviewBlock(state)}
          onPreview={() => void previewAtlas()}
          custom={state.mode === 'custom'}
        />
        <div className="generate-panel__locked" inert={setupLocked}>
          {state.step !== null && state.status !== 'idle' && <ProgressSteps step={state.step} fraction={state.fraction} failed={state.status === 'failed'} imageCount={state.mode === 'custom' && state.customPlan !== null ? countImages(state.customPlan) : 1} onCancel={onCancel} {...(viewLog === undefined ? {} : { onViewLog: viewLog })} />}
          {state.status === 'failed' && state.error !== null && state.error.category !== 'aborted' && <RunErrorBlock error={state.error} onRetry={onRetry} failedSheets={state.failedSheets} {...(onKeepWithout === undefined ? {} : { onKeepWithout })} />}
          {state.notice !== null && <p className="generate-panel__notice" role="status">{state.notice}</p>}
          <UnwrapStatusBlock unwrap={state.unwrap} onDismissError={state.clearUnwrap} />
          <div className="generate-panel__actions">
            {!(state.status === 'running' && state.step !== null) && <GenerateButton availability={describeGenerateAvailability(state)} onGenerate={onGenerate} onGenerateUv={() => setUvDialogOpen(true)} />}
            <IconButton label="Custom setup" icon={<Icon name="gear" />} disabled={state.status === 'running'} onClick={() => { state.setMode('custom'); onSetUpCustom?.(); }} />
          </div>
        </div>
      </div>
      <div className="generate-panel__page" role="tabpanel" aria-label="Run log" hidden={tab !== 'debug'} inert={setupLocked}>
        <DebugTab projectId={projectId} records={records} revealId={reveal.id} revealCount={reveal.count} onRemove={logStore.getState().remove} />
      </div>
      {previewPng !== null && <AtlasPreviewViewer png={previewPng} onClose={() => setPreviewPng(null)} />}
      <UvOptionsDialog
        open={uvDialogOpen}
        {...(uvNotice === undefined ? {} : { notice: uvNotice })}
        onCancel={() => setUvDialogOpen(false)}
        onConfirm={(uvOptions) => {
          setUvDialogOpen(false);
          onGenerateUv(uvOptions);
        }}
      />
    </section>
  );
}
