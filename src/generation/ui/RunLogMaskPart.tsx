import { Tooltip } from '../../ui-kit';
import type { MaskRunLog } from '../runLogStore';
import { RunLogPicture } from './RunLogPicture';

// mask-generation R13: the labelled sheet the describe model saw, then the components it listed, each with the swatch of its palette colour.
export function RunLogMaskPart({ masks }: { masks: MaskRunLog }): React.JSX.Element {
  return (
    <>
      {masks.sheet !== null && <RunLogPicture blob={masks.sheet} label="Labelled sheet" alt="Labelled sheet sent to the describe model" fileStem="labelled-sheet" />}
      {masks.components.length > 0 && (
        <div className="run-log-row__part">
          <Tooltip heading="Components" text="The materials the describe model found, and the colour each is painted with."><span className="run-log-row__caption">Components</span></Tooltip>
          <ul className="run-log-row__components">
            {masks.components.map((component, index) => (
              <li key={index} className="run-log-row__component">
                <span className="run-log-row__swatch" data-testid="component-swatch" style={{ backgroundColor: component.hex }} aria-hidden="true" />
                <span className="run-log-row__component-text">
                  <strong>{component.name}</strong>
                  <span>{component.description}</span>
                  <span>{component.location}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
