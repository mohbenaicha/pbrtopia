import { SegmentedControl, Select, type SegmentOption, Slider, Toggle } from '../../ui-kit';
import { HDRI_CHOICES } from '../hdriCatalog';
import { DEFAULT_VIEWPORT_SETTINGS, type MapAdjust, type ViewportSettings } from '../viewportSettings';

export interface ViewportControlsProps {
  settings: ViewportSettings;
  onChange: (patch: Partial<ViewportSettings>) => void;
}

const HDRI_OPTIONS = HDRI_CHOICES.map((choice) => ({ value: choice.id, label: choice.label }));
const SHADING_OPTIONS: SegmentOption<'smooth' | 'flat'>[] = [
  { value: 'smooth', label: 'Smooth' },
  { value: 'flat', label: 'Flat' },
];
const twoDecimals = (value: number): string => value.toFixed(2);

// The controls of the viewport settings, one function per subsection (R14), so the gear popover and the Settings page lay the same controls out their own way.

export function LightControls({ settings, onChange }: ViewportControlsProps): React.JSX.Element {
  return (
    <>
      <Slider
        label="Intensity"
        layout="row"
        value={settings.environmentIntensity}
        min={0}
        max={3}
        step={0.01}
        format={twoDecimals}
        resetTo={DEFAULT_VIEWPORT_SETTINGS.environmentIntensity}
        onChange={(environmentIntensity) => onChange({ environmentIntensity })}
      />
      <Slider
        label="Rotation"
        layout="row"
        resetTo={DEFAULT_VIEWPORT_SETTINGS.environmentRotationDeg}
        value={settings.environmentRotationDeg}
        min={0}
        max={360}
        step={1}
        format={(degrees) => `${Math.round(degrees)}°`}
        disabled={settings.autoRotate}
        onChange={(environmentRotationDeg) => onChange({ environmentRotationDeg })}
      />
      <Toggle label="Auto rotate" checked={settings.autoRotate} onChange={(autoRotate) => onChange({ autoRotate })} />
    </>
  );
}

export function HdriControls({ settings, onChange }: ViewportControlsProps): React.JSX.Element {
  const builtIn = settings.hdri === 'studio';
  return (
    <>
      <Toggle
        label="Background"
        checked={settings.backgroundVisible}
        disabled={builtIn}
        hint={builtIn ? 'The built-in studio has no backdrop' : undefined}
        onChange={(backgroundVisible) => onChange({ backgroundVisible })}
      />
      <Select label="HDRI" hideLabel options={HDRI_OPTIONS} value={settings.hdri} onChange={(hdri) => onChange({ hdri })} />
    </>
  );
}

function MapAdjustSliders({ settings, onChange, strength, contrast }: ViewportControlsProps & { strength: keyof MapAdjust; contrast: keyof MapAdjust }): React.JSX.Element {
  const adjust = (key: keyof MapAdjust, value: number): void => onChange({ mapAdjust: { ...settings.mapAdjust, [key]: value } });
  return (
    <>
      <Slider label="Strength" layout="row" value={settings.mapAdjust[strength]} min={0} max={3} step={0.01} format={twoDecimals} resetTo={DEFAULT_VIEWPORT_SETTINGS.mapAdjust[strength]} onChange={(value) => adjust(strength, value)} />
      <Slider label="Contrast" layout="row" value={settings.mapAdjust[contrast]} min={0} max={3} step={0.01} format={twoDecimals} resetTo={DEFAULT_VIEWPORT_SETTINGS.mapAdjust[contrast]} onChange={(value) => adjust(contrast, value)} />
    </>
  );
}

export const MetalControls = (props: ViewportControlsProps): React.JSX.Element => <MapAdjustSliders {...props} strength="metalStrength" contrast="metalContrast" />;

export const RoughnessControls = (props: ViewportControlsProps): React.JSX.Element => <MapAdjustSliders {...props} strength="roughStrength" contrast="roughContrast" />;

export const NormalControls = (props: ViewportControlsProps): React.JSX.Element => <MapAdjustSliders {...props} strength="normalStrength" contrast="normalContrast" />;

export function ShadingControls({ settings, onChange }: ViewportControlsProps): React.JSX.Element {
  return (
    <>
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
        resetTo={DEFAULT_VIEWPORT_SETTINGS.smoothAngleDeg}
        onChange={(smoothAngleDeg) => onChange({ smoothAngleDeg })}
      />
    </>
  );
}

export function MeshControls({ settings, onChange }: ViewportControlsProps): React.JSX.Element {
  return <Toggle label="Wireframe" checked={settings.wireframe} onChange={(wireframe) => onChange({ wireframe })} />;
}
