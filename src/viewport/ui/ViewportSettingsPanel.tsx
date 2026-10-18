import { Select, Slider, Toggle } from '../../ui-kit';
import { HDRI_CHOICES } from '../hdriCatalog';
import type { MapAdjust, ViewportSettings } from '../viewportSettings';
import './ViewportSettingsPanel.css';

export interface ViewportSettingsPanelProps {
  settings: ViewportSettings;
  onChange: (patch: Partial<ViewportSettings>) => void;
}

const HDRI_OPTIONS = HDRI_CHOICES.map((choice) => ({ value: choice.id, label: choice.label }));
const twoDecimals = (value: number): string => value.toFixed(2);

// The content of the gear popover: light, background and wireframe, and the metal and rough view adjustments.
export function ViewportSettingsPanel({ settings, onChange }: ViewportSettingsPanelProps): React.JSX.Element {
  const adjust = (key: keyof MapAdjust, value: number): void => onChange({ mapAdjust: { ...settings.mapAdjust, [key]: value } });
  const builtIn = settings.hdri === 'studio';
  return (
    <div className="viewport-settings">
      <Select label="HDRI" options={HDRI_OPTIONS} value={settings.hdri} onChange={(hdri) => onChange({ hdri })} />
      <Slider label="Light intensity" value={settings.environmentIntensity} min={0} max={3} step={0.01} format={twoDecimals} onChange={(environmentIntensity) => onChange({ environmentIntensity })} />
      <Slider
        label="Light rotation"
        value={settings.environmentRotationDeg}
        min={0}
        max={360}
        step={1}
        format={(degrees) => `${Math.round(degrees)}°`}
        disabled={settings.autoRotate}
        onChange={(environmentRotationDeg) => onChange({ environmentRotationDeg })}
      />
      <Toggle label="Auto-rotate" checked={settings.autoRotate} onChange={(autoRotate) => onChange({ autoRotate })} />
      <Toggle
        label="Background"
        checked={settings.backgroundVisible}
        disabled={builtIn}
        hint={builtIn ? 'The built-in studio has no backdrop' : undefined}
        onChange={(backgroundVisible) => onChange({ backgroundVisible })}
      />
      <Toggle label="Wireframe" checked={settings.wireframe} onChange={(wireframe) => onChange({ wireframe })} />
      <Slider label="Metal strength" value={settings.mapAdjust.metalStrength} min={0} max={3} step={0.01} format={twoDecimals} onChange={(value) => adjust('metalStrength', value)} />
      <Slider label="Metal contrast" value={settings.mapAdjust.metalContrast} min={0} max={3} step={0.01} format={twoDecimals} onChange={(value) => adjust('metalContrast', value)} />
      <Slider label="Rough strength" value={settings.mapAdjust.roughStrength} min={0} max={3} step={0.01} format={twoDecimals} onChange={(value) => adjust('roughStrength', value)} />
      <Slider label="Rough contrast" value={settings.mapAdjust.roughContrast} min={0} max={3} step={0.01} format={twoDecimals} onChange={(value) => adjust('roughContrast', value)} />
    </div>
  );
}
