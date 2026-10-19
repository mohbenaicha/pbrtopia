import { useState } from 'react';
import { useStore, type StoreApi } from 'zustand';
import { Button } from '../../ui-kit';
import { optionsForModel } from '../catalog/optionsForModel';
import { describeGenerateAvailability } from '../generateAvailability';
import { findCatalogModel, generateStore, type GenerateState, type ReferenceImage } from '../generateStore';
import { ChannelToggle } from './ChannelToggle';
import { GenerateButton } from './GenerateButton';
import { ModelSelect } from './ModelSelect';
import { QualitySelect } from './QualitySelect';
import { readImageFile } from './readImageFile';
import { ReferenceStrip } from './ReferenceStrip';
import { ResolutionSelect } from './ResolutionSelect';
import './GeneratePanel.css';

export interface GeneratePanelProps {
  onGenerate: () => void;
  onGenerateUv: () => void;
  onDebugProjection: () => void;
  debugDisabled?: boolean;
  store?: StoreApi<GenerateState>;
  readImageFile?: (file: File) => Promise<ReferenceImage>;
  today?: string; // YYYY-MM-DD; defaults to the current date
}

// R1: the Generate panel: prompt, references, channel, model, resolution, quality, Generate and the debug-projection button.
// The handlers run the flows (G9, G10); this panel only shows state and reports clicks.
export function GeneratePanel({ onGenerate, onGenerateUv, onDebugProjection, debugDisabled = false, store = generateStore, readImageFile: readFile = readImageFile, today = new Date().toISOString().slice(0, 10) }: GeneratePanelProps): React.JSX.Element {
  const state = useStore(store);
  const [notice, setNotice] = useState<string | null>(null);
  const model = findCatalogModel(state.catalog, state.provider, state.modelId);
  const options = model === null ? { resolutions: [], qualityLevels: [] } : optionsForModel(model, state.maxTextureSize);

  const addFiles = async (files: File[]): Promise<void> => {
    const settled = await Promise.allSettled(files.map((file) => readFile(file)));
    const images: ReferenceImage[] = [];
    const unreadable: string[] = [];
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') images.push(result.value);
      else unreadable.push(files[index]?.name ?? 'a file');
    });
    const { refused } = store.getState().addReferences(images);
    const total = model?.maxReferenceImages;
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
      <QualitySelect levels={options.qualityLevels} value={state.quality} onChange={state.setQuality} />
      <div className="generate-panel__actions">
        <GenerateButton availability={describeGenerateAvailability(state)} onGenerate={onGenerate} onGenerateUv={onGenerateUv} />
        <Button variant="ghost" disabled={debugDisabled} onClick={onDebugProjection}>Debug projection</Button>
      </div>
    </section>
  );
}
