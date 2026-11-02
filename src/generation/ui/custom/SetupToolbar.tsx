import { useState } from 'react';
import { Button, ConfirmDialog, Dialog, Icon, IconButton, Select, TextInput, Toggle, type SelectOption } from '../../../ui-kit';
import type { CustomPlanRecord, NamedPlanRecord } from '../../custom/planTypes';
import type { PresetName } from '../../custom/presets';

interface SetupToolbarProps {
  presets: readonly { name: PresetName; label: string }[];
  activePreset: PresetName | 'custom';
  plan: CustomPlanRecord;
  presetsEnabled: boolean; // false when no model can fill a preset
  savedSetups: NamedPlanRecord[];
  syncSettings: boolean;
  onSyncSettingsChange: (on: boolean) => void;
  onPreset: (preset: PresetName) => void;
  onLoad: (setup: NamedPlanRecord) => void;
  onDelete: (name: string) => void;
  onSave: (name: string) => void;
}

const PRESET_PREFIX = 'preset:';
const SAVED_PREFIX = 'saved:';

// Custom R2, R4, R5, R6: Save setup (a floppy-disc icon button opening a dialog asking for a name, and a confirm before it replaces a setup of that name), the Layout preset dropdown
// (the presets, then the saved setups), the Delete setup button for a chosen saved setup, and the Sync settings switch.
export function SetupToolbar({ presets, activePreset, plan, presetsEnabled, savedSetups, syncSettings, onSyncSettingsChange, onPreset, onLoad, onDelete, onSave }: SetupToolbarProps): React.JSX.Element {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [replacing, setReplacing] = useState<string | null>(null);
  const trimmed = name.trim();
  const planKey = JSON.stringify(plan);
  const chosenSetup = savedSetups.find((setup) => JSON.stringify(setup.plan) === planKey) ?? null;

  const options: SelectOption[] = [
    ...(chosenSetup === null && activePreset === 'custom' ? [{ value: 'custom', label: 'Custom' }] : []),
    ...(presetsEnabled ? presets.map((preset) => ({ value: `${PRESET_PREFIX}${preset.name}`, label: preset.label, group: 'Presets' })) : []),
    ...savedSetups.map((setup) => ({ value: `${SAVED_PREFIX}${setup.name}`, label: setup.name, group: 'Saved setups' })),
  ];
  const value = chosenSetup !== null ? `${SAVED_PREFIX}${chosenSetup.name}` : activePreset === 'custom' ? 'custom' : `${PRESET_PREFIX}${activePreset}`;

  const choose = (picked: string): void => {
    if (picked.startsWith(PRESET_PREFIX)) onPreset(picked.slice(PRESET_PREFIX.length) as PresetName);
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
        <Select label="Layout preset" options={options} value={value} onChange={choose} />
        {chosenSetup !== null && <IconButton label="Delete setup" icon={<Icon name="trash" />} onClick={() => onDelete(chosenSetup.name)} />}
      </span>
      <span className="setup-toolbar__sync">
        <Toggle label="Sync settings" checked={syncSettings} onChange={onSyncSettingsChange} />
      </span>
      <IconButton label="Save setup" icon={<Icon name="save" />} onClick={() => setNaming(true)} />
      <Dialog
        open={naming}
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
          <TextInput label="Name" value={name} onChange={setName} placeholder="Orc head" />
        </form>
      </Dialog>
      <ConfirmDialog open={replacing !== null} title={`Replace setup "${replacing ?? ''}"?`} confirmLabel="Replace" busy={false} onConfirm={() => replacing !== null && finish(replacing)} onCancel={() => setReplacing(null)} />
    </div>
  );
}
