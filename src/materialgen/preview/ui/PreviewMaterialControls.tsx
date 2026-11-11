import { SettingsSubsection } from '@shared/viewport';
import { CommitSlider, Slider } from '@shared/ui-kit';
import { DEFAULT_PREVIEW_PREFS, DEFAULT_PREVIEW_VALUES, type PreviewPrefs, type PreviewValues } from '@mat/storage';
import { segmentsFor } from '../math/meshSegments';

interface PreviewMaterialControlsProps {
  values?: PreviewValues; // per project; absent where no project is open (Settings), which leaves out Height and Tiling
  onValuesChange?: (patch: Partial<PreviewValues>) => void;
  prefs: PreviewPrefs; // app-wide
  onPrefsChange: (patch: Partial<PreviewPrefs>) => void;
}

const twoDecimals = (value: number): string => value.toFixed(2);
const MESH_RESOLUTION_RANGE = { min: 1, max: 4, step: 1, format: (level: number): string => String(segmentsFor(level)) };

/**
 * Preview R34-R37, R39, R42, R43: the subsections the preview adds under Material: Height (Scale, Level, Contrast), Occlusion (Intensity), Tiling (X, Y) and Mesh
 * (Resolution). The gear popover and Settings > Viewport both draw this component; Settings has no open project, so it passes no per-project values and gets
 * only Occlusion and Mesh.
 */
export function PreviewMaterialControls({ values, onValuesChange, prefs, onPrefsChange }: PreviewMaterialControlsProps): React.JSX.Element {
  const perProject = values !== undefined && onValuesChange !== undefined ? { values, onValuesChange } : null;
  return (
    <>
      {perProject !== null && (
        <SettingsSubsection title="Height">
          <Slider label="Scale" layout="row" value={perProject.values.heightScale} min={0} max={0.1} step={0.001} format={(value) => value.toFixed(3)} resetTo={DEFAULT_PREVIEW_VALUES.heightScale} onChange={(heightScale) => perProject.onValuesChange({ heightScale })} />
          <Slider label="Level" layout="row" value={perProject.values.heightLevel} min={0} max={1} step={0.01} format={twoDecimals} resetTo={DEFAULT_PREVIEW_VALUES.heightLevel} onChange={(heightLevel) => perProject.onValuesChange({ heightLevel })} />
          <Slider label="Contrast" layout="row" value={perProject.values.heightContrast} min={0} max={3} step={0.01} format={twoDecimals} resetTo={DEFAULT_PREVIEW_VALUES.heightContrast} onChange={(heightContrast) => perProject.onValuesChange({ heightContrast })} />
        </SettingsSubsection>
      )}
      <SettingsSubsection title="Occlusion">
        <Slider label="Intensity" layout="row" value={prefs.aoIntensity} min={0} max={2} step={0.01} format={twoDecimals} resetTo={DEFAULT_PREVIEW_PREFS.aoIntensity} onChange={(aoIntensity) => onPrefsChange({ aoIntensity })} />
      </SettingsSubsection>
      {perProject !== null && (
        <SettingsSubsection title="Tiling">
          <Slider label="X" layout="row" value={perProject.values.tilingX} min={1} max={10} step={1} resetTo={DEFAULT_PREVIEW_VALUES.tilingX} onChange={(tilingX) => perProject.onValuesChange({ tilingX })} />
          <Slider label="Y" layout="row" value={perProject.values.tilingY} min={1} max={10} step={1} resetTo={DEFAULT_PREVIEW_VALUES.tilingY} onChange={(tilingY) => perProject.onValuesChange({ tilingY })} />
        </SettingsSubsection>
      )}
      <SettingsSubsection title="Mesh">
        <CommitSlider label="Resolution" layout="row" value={prefs.meshResolution} range={MESH_RESOLUTION_RANGE} resetTo={DEFAULT_PREVIEW_PREFS.meshResolution} onCommit={(meshResolution) => onPrefsChange({ meshResolution })} />
      </SettingsSubsection>
    </>
  );
}
