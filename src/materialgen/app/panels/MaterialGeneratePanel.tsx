import { useId, useState } from 'react';
import { QuotaWarning, type StorageEstimate } from '@shared/projects';
import { ReadOnlyBanner, RightPanel, useIsDesktopApp } from '@shared/shell';
import { Disclosure, SegmentedControl, Tabs, type SegmentOption, type TabOption } from '@shared/ui-kit';
import type { GenerationPanel } from '@mat/generation';
import type { ColorMode, MaterialRecord, MaterialSize } from '@mat/storage';
import { GenerateSection } from './generate/GenerateSection';
import { ModelSettingsSection } from './generate/ModelSettingsSection';
import { PromptIdeasStrip } from './generate/PromptIdeasStrip';
import { ReferenceImagesSection } from './generate/ReferenceImagesSection';
import { RunLogSection } from './generate/RunLogSection';
import { READ_ONLY_REASON } from './generateReason';
import { SizeField } from './SizeField';
import './generate/generatePanels.css';
import './materialPanels.css';

const COLOR_MODE_OPTIONS: SegmentOption<ColorMode>[] = [
  { value: 'albedo', label: 'Albedo' },
  { value: 'diffuse', label: 'Diffuse' },
];

const carriesFiles = (event: React.DragEvent): boolean => Array.from(event.dataTransfer.types).includes('Files');

type GenerateTab = 'generate' | 'log';
const TABS: TabOption<GenerateTab>[] = [
  { value: 'generate', label: 'Generate' },
  { value: 'log', label: 'Run log', icon: 'bug', iconOnly: true }, // the projection app's Debug tab
];

interface MaterialGeneratePanelProps {
  record: MaterialRecord;
  canWrite: boolean;
  readOnly: boolean; // another tab holds the project (app R13)
  generation: GenerationPanel;
  onEdit(change: (record: MaterialRecord) => MaterialRecord): void;
  onResizeMaps(size: MaterialSize): void;
  resizing: boolean;
  onCustomSetup?: () => void; // generation R10
  storage: { estimate: StorageEstimate | null; full: boolean; warn: boolean };
  onExportProject(): void;
  exporting: boolean;
  exportError: string | null;
  exportDisabledReason: string | null;
}

/**
 * Materialgen app R13, R14, R36: the right panel, laid out like the projection app's Generate panel: the read-only banner and the storage warning,
 * then the tabs Generate (Prompt, Reference images right under it as in the projection app, Color mode, Size, Model settings with the Preset, Generate with Custom setup) and Run log.
 */
export function MaterialGeneratePanel({ record, canWrite, readOnly, generation, onEdit, onResizeMaps, resizing, onCustomSetup, storage, onExportProject, exporting, exportError, exportDisabledReason }: MaterialGeneratePanelProps): React.JSX.Element {
  const promptId = useId();
  const onDisk = useIsDesktopApp();
  const [tab, setTab] = useState<GenerateTab>('generate');
  const [modelsOpen, setModelsOpen] = useState(false);
  const running = generation.run.running;
  const editable = canWrite && !running;

  return (
    <RightPanel>
      <div className="material-panel">
        {(readOnly || storage.warn || exportError !== null) && (
          <div className="material-panel__notes">
            {readOnly && <ReadOnlyBanner />}
            {storage.warn ? (
              <QuotaWarning estimate={storage.estimate} full={storage.full} onExport={onExportProject} exporting={exporting} error={exportError} exportDisabledReason={exportDisabledReason} onDisk={onDisk} />
            ) : (
              exportError !== null && <p role="alert">{exportError}</p>
            )}
          </div>
        )}
        <Tabs label="Generate panel" tabs={TABS} value={tab} onChange={setTab} />
        <div className="material-panel material-panel--padded" role="tabpanel" aria-label="Generate fields" hidden={tab !== 'generate'}>
          <div className="material-panel__field">
            <label className="material-panel__label" htmlFor={promptId}>
              Prompt
            </label>
            <div
              className="prompt-field"
              onDragOver={(event) => {
                if (editable && carriesFiles(event)) event.preventDefault(); // without this the browser refuses the drop
              }}
              onDrop={(event) => {
                const files = Array.from(event.dataTransfer.files);
                if (!editable || files.length === 0) return; // selected text dropped in: the field handles it
                event.preventDefault();
                generation.references.addFiles(files);
              }}
            >
              <textarea
                id={promptId}
                className="material-panel__prompt"
                rows={8}
                value={record.prompt}
                disabled={!canWrite}
                title={canWrite ? undefined : READ_ONLY_REASON}
                onChange={(event) => {
                  const prompt = event.target.value; // read now: the updater may run after the field is reset to the stored value
                  onEdit((current) => ({ ...current, prompt }));
                }}
              />
              <PromptIdeasStrip ideas={generation.ideas} readOnlyReason={canWrite ? null : READ_ONLY_REASON} />
            </div>
            {generation.ideas.error !== null && <p role="alert">{generation.ideas.error}</p>}
          </div>
          <ReferenceImagesSection generation={generation} canWrite={editable} />
          <SegmentedControl label="Color mode" options={COLOR_MODE_OPTIONS} value={record.colorMode} disabled={!editable} onChange={(colorMode) => onEdit((current) => ({ ...current, colorMode }))} />
          <SizeField record={record} canWrite={editable} resizing={resizing} onSizeChange={(size) => onEdit((current) => ({ ...current, size }))} onResizeMaps={onResizeMaps} />
          <Disclosure title="Model settings" open={modelsOpen} onOpenChange={setModelsOpen}>
            <ModelSettingsSection generation={generation} colorMode={record.colorMode} disabled={!editable} />
          </Disclosure>
          <GenerateSection generation={generation} prompt={record.prompt} canWrite={canWrite} {...(onCustomSetup === undefined ? {} : { onCustomSetup })} />
        </div>
        <div className="material-panel material-panel--padded" role="tabpanel" aria-label="Run log" hidden={tab !== 'log'}>
          <RunLogSection log={generation.run.log} />
        </div>
      </div>
    </RightPanel>
  );
}
