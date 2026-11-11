import { ViewportSettingsPanel, type ViewportSettings } from '@shared/viewport';
import { Button } from '@shared/ui-kit';
import type { PreviewPrefs, PreviewValues } from '@mat/storage';
import { NormalDirectionSelect } from './NormalDirectionSelect';
import { PreviewMaterialControls } from './PreviewMaterialControls';
import './previewSettingsPanel.css';

interface PreviewSettingsPanelProps {
  settings: ViewportSettings;
  onChange: (patch: Partial<ViewportSettings>) => void;
  values: PreviewValues;
  onValuesChange: (patch: Partial<PreviewValues>) => void;
  prefs: PreviewPrefs;
  onPrefsChange: (patch: Partial<PreviewPrefs>) => void;
  onReset: () => void; // Reset to defaults (preview R41)
}

/** Preview R42: the gear popover: the shared Environment and Material sections without View, the preview's own Material subsections, and Reset to defaults. */
export function PreviewSettingsPanel({ settings, onChange, values, onValuesChange, prefs, onPrefsChange, onReset }: PreviewSettingsPanelProps): React.JSX.Element {
  return (
    <div className="preview-settings">
      <ViewportSettingsPanel
        settings={settings}
        onChange={onChange}
        hiddenSections={['view']}
        normalExtras={<NormalDirectionSelect value={prefs.normalDirection} onChange={(normalDirection) => onPrefsChange({ normalDirection })} />}
        materialExtras={<PreviewMaterialControls values={values} onValuesChange={onValuesChange} prefs={prefs} onPrefsChange={onPrefsChange} />}
      />
      <Button variant="ghost" onClick={onReset}>
        Reset to defaults
      </Button>
    </div>
  );
}
