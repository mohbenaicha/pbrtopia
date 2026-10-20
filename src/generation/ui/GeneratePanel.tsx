import { useEffect, useRef, useState } from 'react';
import { useStore, type StoreApi } from 'zustand';
import { Button } from '../../ui-kit';
import { listAtlasSizes } from '../catalog/atlasSizes';
import { optionsForModel } from '../catalog/optionsForModel';
import { describeGenerateAvailability } from '../generateAvailability';
import { findCatalogModel, generateStore, type GenerateState, type ReferenceImage } from '../generateStore';
import { AtlasSizeSelect } from './AtlasSizeSelect';
import { ChannelToggle } from './ChannelToggle';
import { EnhancedPromptBlock } from './EnhancedPromptBlock';
import { GenerateButton } from './GenerateButton';
import { ModelSelect } from './ModelSelect';
import { ProgressSteps } from './ProgressSteps';
import { QualitySelect } from './QualitySelect';
import { readImageFile } from './readImageFile';
import { ReferenceStrip } from './ReferenceStrip';
import { ResolutionSelect } from './ResolutionSelect';
import { RunErrorBlock } from './RunErrorBlock';
import { UvOptionsDialog, type UvOptions } from './UvOptionsDialog';
import './GeneratePanel.css';

export interface GeneratePanelProps {
  onGenerate: () => void;
  onGenerateUv: (options: UvOptions) => void;
  onDebugProjection: () => void;
  onCancel: () => void; // Cancel in the step list (R10)
  onRetry: () => void; // Retry in the error block (R9)
  debugDisabled?: boolean;
  store?: StoreApi<GenerateState>;
  readImageFile?: (file: File) => Promise<ReferenceImage>;
  today?: string; // YYYY-MM-DD; defaults to the current date
}

// R1: the Generate panel: prompt, references, channel, model, resolution, quality, Generate and the debug-projection button.
// The handlers run the flows (G9, G10); this panel only shows state and reports clicks.
export function GeneratePanel({ onGenerate, onGenerateUv, onDebugProjection, onCancel, onRetry, debugDisabled = false, store = generateStore, readImageFile: readFile = readImageFile, today = new Date().toISOString().slice(0, 10) }: GeneratePanelProps): React.JSX.Element {
  const state = useStore(store);
  const [notice, setNotice] = useState<string | null>(null);
  const [uvDialogOpen, setUvDialogOpen] = useState(false);
  const mounted = useRef(true);
  const model = findCatalogModel(state.catalog, state.provider, state.modelId);
  const options = model === null ? { resolutions: [], qualityLevels: [] } : optionsForModel(model, state.maxTextureSize);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // A refusal belongs to the model it was made under.
  useEffect(() => setNotice(null), [state.provider, state.modelId]);

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

  return (
    <section className="generate-panel" aria-label="Generate">
      <label className="generate-panel__field">
        <span className="generate-panel__label">Prompt</span>
        <textarea className="generate-panel__prompt" rows={5} value={state.prompt} onChange={(event) => state.setPrompt(event.target.value)} />
      </label>
      <ReferenceStrip references={state.references} notice={notice} onFiles={(files) => void addFiles(files)} onRemove={state.removeReference} />
      <ChannelToggle />
      <ModelSelect catalog={state.catalog} hasKey={state.hasKey} provider={state.provider} modelId={state.modelId} today={today} onSelect={state.selectModel} />
      <ResolutionSelect options={options.resolutions} experimental={model?.experimentalResolutions ?? []} value={state.resolutionKey} onChange={state.setResolution} />
      <AtlasSizeSelect options={listAtlasSizes(state.maxTextureSize)} value={state.atlasKey} onChange={state.setAtlasKey} />
      <QualitySelect levels={options.qualityLevels} value={state.quality} onChange={state.setQuality} />
      {state.step !== null && state.status !== 'idle' && <ProgressSteps step={state.step} fraction={state.fraction} failed={state.status === 'failed'} onCancel={onCancel} />}
      {state.status === 'failed' && state.error !== null && state.error.category !== 'aborted' && <RunErrorBlock error={state.error} onRetry={onRetry} />}
      <div className="generate-panel__actions">
        {!(state.status === 'running' && state.step !== null) && <GenerateButton availability={describeGenerateAvailability(state)} onGenerate={onGenerate} onGenerateUv={() => setUvDialogOpen(true)} />}
        <Button variant="ghost" disabled={debugDisabled} onClick={onDebugProjection}>Debug projection</Button>
      </div>
      <EnhancedPromptBlock text={state.enhancedPrompt} />
      <UvOptionsDialog
        open={uvDialogOpen}
        onCancel={() => setUvDialogOpen(false)}
        onConfirm={(uvOptions) => {
          setUvDialogOpen(false);
          onGenerateUv(uvOptions);
        }}
      />
    </section>
  );
}
