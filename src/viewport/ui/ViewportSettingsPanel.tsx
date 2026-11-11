import type { ReactNode } from 'react';
import { HdriControls, LightControls, MeshControls, MetalControls, NormalControls, RoughnessControls, ShadingControls, type ViewportControlsProps } from './ViewportSettingsControls';
import { SettingsSection, SettingsSubsection } from './SettingsSection';
import './ViewportSettingsPanel.css';

export type ViewportSectionId = 'environment' | 'material' | 'view';

type PanelProps = ViewportControlsProps & {
  hiddenSections?: readonly ViewportSectionId[]; // sections the caller does not offer (the material preview has no View section)
  normalExtras?: ReactNode; // more controls at the end of the Normal subsection (the material preview adds its Normal direction dropdown)
  materialExtras?: ReactNode; // more subsections at the end of Material (the material preview adds Height, Occlusion, Tiling and Mesh)
};

// R14: the content of the gear popover: Environment (Light, HDRI), Material (Metal, Roughness, Normal) and View (Shading: Smooth | Flat and the Angle; Mesh: Wireframe and Grid), every heading at the same indent.
export function ViewportSettingsPanel({ hiddenSections = [], normalExtras, materialExtras, ...controls }: PanelProps): React.JSX.Element {
  const shown = (id: ViewportSectionId): boolean => !hiddenSections.includes(id);
  return (
    <div className="viewport-settings">
      {shown('environment') && (
        <SettingsSection title="Environment">
          <SettingsSubsection title="Light">
            <LightControls {...controls} />
          </SettingsSubsection>
          <SettingsSubsection title="HDRI">
            <HdriControls {...controls} />
          </SettingsSubsection>
        </SettingsSection>
      )}
      {shown('material') && (
        <SettingsSection title="Material">
          <SettingsSubsection title="Metal">
            <MetalControls {...controls} />
          </SettingsSubsection>
          <SettingsSubsection title="Roughness">
            <RoughnessControls {...controls} />
          </SettingsSubsection>
          <SettingsSubsection title="Normal">
            <NormalControls {...controls} />
            {normalExtras}
          </SettingsSubsection>
          {materialExtras}
        </SettingsSection>
      )}
      {shown('view') && (
        <SettingsSection title="View">
          <SettingsSubsection title="Shading">
            <ShadingControls {...controls} />
          </SettingsSubsection>
          <SettingsSubsection title="Mesh">
            <MeshControls {...controls} />
          </SettingsSubsection>
        </SettingsSection>
      )}
    </div>
  );
}
