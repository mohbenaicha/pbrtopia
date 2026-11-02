import { Icon } from '../../../ui-kit';
import type { AuxSheetPlan } from '../../custom/planTypes';
import type { SheetPreview } from '../../custom/sheetPreview';
import { SheetPreviewCanvas } from './SheetPreviewCanvas';
import { SheetSettingsFields, type SheetSettingsFieldsProps } from './SheetSettingsFields';

interface AuxSheetCardProps {
  aux: AuxSheetPlan | null; // null: the aux sheet is off
  preview: SheetPreview | null; // the aux canvas and its tile grid; null while unknown
  fields: Omit<SheetSettingsFieldsProps, 'name' | 'settings' | 'onChange'>;
  onIncludedChange: (included: boolean) => void;
  onSettings: SheetSettingsFieldsProps['onChange'];
}

const HINT = 'Fills in what the main views cannot see. Uses one image.';

// Custom R5: the one fixed card at the end: the Include auxiliary cameras checkbox, an area at the canvas aspect (it takes no camera drops), and its own model, resolution and quality.
export function AuxSheetCard({ aux, preview, fields, onIncludedChange, onSettings }: AuxSheetCardProps): React.JSX.Element {
  return (
    <section className="setup-card setup-card--aux" role="group" aria-label="Auxiliary image">
      <label className="setup-card__include" title={HINT}>
        <input type="checkbox" checked={aux !== null} onChange={(event) => onIncludedChange(event.target.checked)} />
        <span>Include auxiliary cameras</span>
      </label>
      {aux !== null && (
        <>
          <div className="setup-drop setup-drop--aux" data-testid="canvas-box">
            {preview === null ? (
              <span className="setup-drop__empty">
                <Icon name="grid" size={16} />
                Auxiliary views
              </span>
            ) : (
              <SheetPreviewCanvas preview={preview} snapshots={null} trims={null} />
            )}
          </div>
          <SheetSettingsFields {...fields} name="Auxiliary" settings={aux.settings} onChange={onSettings} />
        </>
      )}
    </section>
  );
}
