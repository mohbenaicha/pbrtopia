import { Icon, IconButton, Tooltip } from '../../../ui-kit';
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
  onPreviewAtlas?: (() => void) | undefined; // custom R51: shows the aux sheet as a run would send it; no button without it
  previewing?: boolean; // the picture is being made
  previewMessage?: string | null; // why the last preview failed
}

const HINT = 'Fills in what the main views cannot see. Uses one image.';
const PREVIEW_HINT = 'Shows the close-up views the aux image would be made of, as a run would send them. Nothing is sent to a model.';
const NOT_READY = 'The views are still being measured.';

// Custom R5: the one fixed card at the end: the Include auxiliary cameras checkbox, an area at the canvas aspect (it takes no camera drops), and its own model, resolution and quality.
// Custom R51: with the sheet included, a Preview atlas button beside the checkbox.
export function AuxSheetCard({ aux, preview, fields, onIncludedChange, onSettings, onPreviewAtlas, previewing = false, previewMessage = null }: AuxSheetCardProps): React.JSX.Element {
  return (
    <section className="setup-card setup-card--aux" role="group" aria-label="Auxiliary image">
      <div className="setup-card__aux-head">
        <Tooltip heading="Auxiliary cameras" text={HINT}>
          <label className="setup-card__include">
            <input type="checkbox" checked={aux !== null} onChange={(event) => onIncludedChange(event.target.checked)} />
            <span>Include auxiliary cameras</span>
          </label>
        </Tooltip>
        {aux !== null && onPreviewAtlas !== undefined && (
          <IconButton
            label="Preview atlas"
            hint={PREVIEW_HINT}
            icon={<Icon name="eye" />}
            loading={previewing}
            disabled={preview === null}
            {...(preview === null ? { disabledReason: NOT_READY } : {})}
            onClick={onPreviewAtlas}
          />
        )}
      </div>
      {aux !== null && previewMessage !== null && <p className="setup-card__message" role="status">{previewMessage}</p>}
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
