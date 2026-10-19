import { useId } from 'react';
import { SegmentedControl, Select, type SegmentOption, Slider, Toggle } from '../../ui-kit';
import { HDRI_CHOICES } from '../hdriCatalog';
import type { MapAdjust, ViewportSettings } from '../viewportSettings';
import './ViewportSettingsPanel.css';

export interface ViewportSettingsPanelProps {
  settings: ViewportSettings;
  onChange: (patch: Partial<ViewportSettings>) => void;
}

const HDRI_OPTIONS = HDRI_CHOICES.map((choice) => ({ value: choice.id, label: choice.label }));
const SHADING_OPTIONS: SegmentOption<'smooth' | 'flat'>[] = [
  { value: 'smooth', label: 'Smooth' },
  { value: 'flat', label: 'Flat' },
];
const twoDecimals =(value: number): string => value.toFixed(2);

// A bold subheading with the controls under it, so the controls inside can leave its word out of their labels.
function Subsection({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  const id = useId();
  return (
    <div className="viewport-settings__subsection" role="group" aria-labelledby={id}>
      <h4 className="viewport-settings__subheading" id={id}>{title}</h4>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="viewport-settings__section">
      <h3 className="viewport-settings__heading">{title}</h3>
      {children}
    </section>
  );
}

// R14: the content of the gear popover: Environment (Light, HDRI), Material (Metal, Roughness) and View (Shading: Smooth | Flat and the Angle; Mesh: Wireframe), every heading at the same indent.
export function ViewportSettingsPanel({ settings, onChange }: ViewportSettingsPanelProps): React.JSX.Element {
  const adjust = (key: keyof MapAdjust, value: number): void => onChange({ mapAdjust: { ...settings.mapAdjust, [key]: value } });
  const builtIn = settings.hdri === 'studio';
  const mapSlider = (label: 'Strength' | 'Contrast', key: keyof MapAdjust): React.JSX.Element => (
    <Slider label={label} layout="row" value={settings.mapAdjust[key]} min={0} max={3} step={0.01} format={twoDecimals} onChange={(value) => adjust(key, value)} />
  );
  return (
    <div className="viewport-settings">
      <Section title="Environment">
        <Subsection title="Light">
          <Slider label="Intensity" layout="row" value={settings.environmentIntensity} min={0} max={3} step={0.01} format={twoDecimals} onChange={(environmentIntensity) => onChange({ environmentIntensity })} />
          <Slider
            label="Rotation"
            layout="row"
            value={settings.environmentRotationDeg}
            min={0}
            max={360}
            step={1}
            format={(degrees) => `${Math.round(degrees)}°`}
            disabled={settings.autoRotate}
            onChange={(environmentRotationDeg) => onChange({ environmentRotationDeg })}
          />
          <Toggle label="Auto rotate" checked={settings.autoRotate} onChange={(autoRotate) => onChange({ autoRotate })} />
        </Subsection>
        <Subsection title="HDRI">
          <Toggle
            label="Background"
            checked={settings.backgroundVisible}
            disabled={builtIn}
            hint={builtIn ? 'The built-in studio has no backdrop' : undefined}
            onChange={(backgroundVisible) => onChange({ backgroundVisible })}
          />
          <Select label="HDRI" hideLabel options={HDRI_OPTIONS} value={settings.hdri} onChange={(hdri) => onChange({ hdri })} />
        </Subsection>
      </Section>
      <Section title="Material">
        <Subsection title="Metal">
          {mapSlider('Strength', 'metalStrength')}
          {mapSlider('Contrast', 'metalContrast')}
        </Subsection>
        <Subsection title="Roughness">
          {mapSlider('Strength', 'roughStrength')}
          {mapSlider('Contrast', 'roughContrast')}
        </Subsection>
      </Section>
      <Section title="View">
        <Subsection title="Shading">
          <SegmentedControl label="Shading" options={SHADING_OPTIONS} value={settings.flatShading ? 'flat' : 'smooth'} onChange={(choice) => onChange({ flatShading: choice === 'flat' })} />
          <Slider
            label="Angle"
            layout="row"
            value={settings.smoothAngleDeg}
            min={0}
            max={180}
            step={1}
            format={(degrees) => (degrees >= 180 ? 'Off' : `${Math.round(degrees)}°`)}
            disabled={settings.flatShading}
            onChange={(smoothAngleDeg) => onChange({ smoothAngleDeg })}
          />
        </Subsection>
        <Subsection title="Mesh">
          <Toggle label="Wireframe" checked={settings.wireframe} onChange={(wireframe) => onChange({ wireframe })} />
        </Subsection>
      </Section>
    </div>
  );
}
