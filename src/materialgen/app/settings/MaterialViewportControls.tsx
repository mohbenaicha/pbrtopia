import { SettingsGroup, type ViewportControlProps } from '@shared/shell';
import { HdriControls, LightControls, MetalControls, NormalControls, RoughnessControls } from '@shared/viewport';
import { NormalDirectionSelect, PreviewMaterialControls } from '@mat/preview';
import type { PreviewPrefs } from '@mat/storage';

interface MaterialViewportControlsProps extends ViewportControlProps {
  prefs: PreviewPrefs;
  onPrefsChange: (patch: Partial<PreviewPrefs>) => void;
}

/**
 * Materialgen app R43, preview R43: the viewport controls the material preview uses, with the app-wide preview prefs (Occlusion, Mesh) from the same component as the
 * gear popover. No grid, wireframe, orthographic, face smoothing or axis gizmo; no Height or Tiling, which belong to a project.
 */
export function MaterialViewportControls({ prefs, onPrefsChange, ...controls }: MaterialViewportControlsProps): React.JSX.Element {
  return (
    <>
      <SettingsGroup title="Light">
        <LightControls {...controls} />
      </SettingsGroup>
      <SettingsGroup title="HDRI">
        <HdriControls {...controls} />
      </SettingsGroup>
      <SettingsGroup title="Metal">
        <MetalControls {...controls} />
      </SettingsGroup>
      <SettingsGroup title="Roughness">
        <RoughnessControls {...controls} />
      </SettingsGroup>
      <SettingsGroup title="Normal">
        <NormalControls {...controls} />
        <NormalDirectionSelect value={prefs.normalDirection} onChange={(normalDirection) => onPrefsChange({ normalDirection })} />
      </SettingsGroup>
      <SettingsGroup title="Material preview">
        <PreviewMaterialControls prefs={prefs} onPrefsChange={onPrefsChange} />
      </SettingsGroup>
    </>
  );
}
