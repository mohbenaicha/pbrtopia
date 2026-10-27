import { useId } from 'react';
import { HdriControls, LightControls, MeshControls, MetalControls, NormalControls, RoughnessControls, ShadingControls, type ViewportControlsProps } from './ViewportSettingsControls';
import './ViewportSettingsPanel.css';

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

// R14: the content of the gear popover: Environment (Light, HDRI), Material (Metal, Roughness, Normal) and View (Shading: Smooth | Flat and the Angle; Mesh: Wireframe and Grid), every heading at the same indent.
export function ViewportSettingsPanel(controls: ViewportControlsProps): React.JSX.Element {
  return (
    <div className="viewport-settings">
      <Section title="Environment">
        <Subsection title="Light">
          <LightControls {...controls} />
        </Subsection>
        <Subsection title="HDRI">
          <HdriControls {...controls} />
        </Subsection>
      </Section>
      <Section title="Material">
        <Subsection title="Metal">
          <MetalControls {...controls} />
        </Subsection>
        <Subsection title="Roughness">
          <RoughnessControls {...controls} />
        </Subsection>
        <Subsection title="Normal">
          <NormalControls {...controls} />
        </Subsection>
      </Section>
      <Section title="View">
        <Subsection title="Shading">
          <ShadingControls {...controls} />
        </Subsection>
        <Subsection title="Mesh">
          <MeshControls {...controls} />
        </Subsection>
      </Section>
    </div>
  );
}
