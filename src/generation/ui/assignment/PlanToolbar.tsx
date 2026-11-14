import { useState } from 'react';
import { Button, ConfirmDialog, Dialog, Icon, IconButton, Select, TextInput, Toggle, type SelectOption } from '../../../ui-kit';

export interface ToolbarPreset {
  id: string;
  label: string;
}

export interface ToolbarSetup<Plan> {
  name: string;
  plan: Plan;
}

interface PlanToolbarProps<Plan> {
  presets: readonly ToolbarPreset[];
  activePreset: string; // a preset id, or 'custom'
  chosenSetup: string | null; // the name of the saved setup the host finds equal to the edited plan, or null
  presetsEnabled: boolean; // false when no model can fill a preset
  savedSetups: readonly ToolbarSetup<Plan>[];
  syncSettings: boolean;
  namePlaceholder: string;
  onSyncSettingsChange: (on: boolean) => void;
  onPreset: (presetId: string) => void;
  onLoad: (setup: ToolbarSetup<Plan>) => void;
  onDelete: (name: string) => void;
  onSave: (name: string) => void;
}

const PRESET_PREFIX = 'preset:';
const SAVED_PREFIX = 'saved:';

/**
 * Custom R2, R4, R5, R6, generation R10, R17, R20: Save setup (a floppy-disc icon button opening a dialog asking for a name, and a confirm before it replaces a setup of that name),
 * the Layout preset dropdown (the presets, then the saved setups), the Delete setup button for a chosen saved setup, and the Sync settings switch. It never reads a plan's content.
 */
export function PlanToolbar<Plan>({ presets, activePreset, chosenSetup, presetsEnabled, savedSetups, syncSettings, namePlaceholder, onSyncSettingsChange, onPreset, onLoad, onDelete, onSave }: PlanToolbarProps<Plan>): React.JSX.Element {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [replacing, setReplacing] = useState<string | null>(null);
  const trimmed = name.trim();

  const options: SelectOption[] = [
    ...(chosenSetup === null && activePreset === 'custom' ? [{ value: 'custom', label: 'Custom' }] : []),
    ...(presetsEnabled ? presets.map((preset) => ({ value: `${PRESET_PREFIX}${preset.id}`, label: preset.label, group: 'Presets' })) : []),
    ...savedSetups.map((setup) => ({ value: `${SAVED_PREFIX}${setup.name}`, label: setup.name, group: 'Saved setups' })),
  ];
  const value = chosenSetup !== null ? `${SAVED_PREFIX}${chosenSetup}` : activePreset === 'custom' ? 'custom' : `${PRESET_PREFIX}${activePreset}`;

  const choose = (picked: string): void => {
    if (picked.startsWith(PRESET_PREFIX)) onPreset(picked.slice(PRESET_PREFIX.length));
    else if (picked.startsWith(SAVED_PREFIX)) {
      const setup = savedSetups.find((entry) => entry.name === picked.slice(SAVED_PREFIX.length));
      if (setup !== undefined) onLoad(setup);
    }
  };
  const close = (): void => {
    setNaming(false);
    setName('');
  };
  const finish = (saveAs: string): void => {
    onSave(saveAs);
    setReplacing(null);
    close();
  };
  const submit = (): void => {
    if (trimmed === '') return;
    if (savedSetups.some((setup) => setup.name === trimmed)) setReplacing(trimmed);
    else finish(trimmed);
  };

  return (
    <div className="setup-toolbar">
      <span className="setup-toolbar__preset">
        <Select label="Layout preset" title="A saved arrangement of which views go on which images." options={options} value={value} onChange={choose} />
        {chosenSetup !== null && <IconButton label="Delete setup" icon={<Icon name="trash" />} onClick={() => onDelete(chosenSetup)} />}
      </span>
      <span className="setup-toolbar__sync">
        <Toggle label="Sync settings" hint="Gives every image the same model, resolution and quality." checked={syncSettings} onChange={onSyncSettingsChange} />
      </span>
      <IconButton label="Save setup" icon={<Icon name="save" />} onClick={() => setNaming(true)} />
      <Dialog
        open={naming && replacing === null} // the replace question takes its place, so Escape closes only the one on top
        title="Save setup"
        onClose={close}
        actions={
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button variant="primary" disabled={trimmed === ''} onClick={submit}>Save</Button>
          </>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <TextInput label="Name" tip="The name this layout is saved under in the preset list." value={name} onChange={setName} placeholder={namePlaceholder} />
        </form>
      </Dialog>
      <ConfirmDialog open={replacing !== null} title={`Replace setup "${replacing ?? ''}"?`} confirmLabel="Replace" busy={false} onConfirm={() => replacing !== null && finish(replacing)} onCancel={() => setReplacing(null)} />
    </div>
  );
}
