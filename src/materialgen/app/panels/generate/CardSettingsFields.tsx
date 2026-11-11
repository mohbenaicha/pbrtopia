import { findCatalogModel, ModelSelect, QualitySelect, ResolutionSelect, type ModelCatalog } from '@shared/generation';
import type { Provider } from '@shared/keys';
import { listCardOptions, retargetCardSettings, type SheetSettings } from '@mat/generation';

interface CardSettingsFieldsProps {
  name: string; // "Image 2" or "Metal-Roughness": prefixes the fields' names; empty when one card is shown alone (the labels are then just Model, Resolution, Quality)
  settings: SheetSettings;
  mapCount: number; // the maps on the card, which the layout of the new resolution is checked for
  catalog: ModelCatalog;
  hasKey: Record<Provider, boolean>;
  maxTextureSize: number;
  disabled: boolean;
  onChange(settings: SheetSettings): void;
}

const today = (): string => new Date().toISOString().slice(0, 10);

/** Generation R16, R26-R29: the model, resolution and quality of one card, from the catalog's lists minus the family's hidden levels; a model change retargets the rest. */
export function CardSettingsFields({ name, settings, mapCount, catalog, hasKey, maxTextureSize, disabled, onChange }: CardSettingsFieldsProps): React.JSX.Element {
  const model = findCatalogModel(catalog, settings.provider, settings.modelId);
  const options = model === null ? { resolutions: [], qualityLevels: [], startQuality: null } : listCardOptions(model, maxTextureSize);
  const named = (field: string): string => (name === '' ? field : `${name} ${field.toLowerCase()}`);
  return (
    <fieldset className="model-card__fields" disabled={disabled}>
      <ModelSelect
        label={named('Model')}
        catalog={catalog}
        hasKey={hasKey}
        provider={settings.provider}
        modelId={settings.modelId}
        today={today()}
        onSelect={(provider, modelId) => {
          const next = findCatalogModel(catalog, provider, modelId);
          if (next !== null) onChange(retargetCardSettings(settings, next, maxTextureSize, mapCount));
        }}
      />
      <ResolutionSelect label={named('Resolution')} options={options.resolutions} experimental={model?.experimentalResolutions ?? []} value={settings.resolutionKey} onChange={(resolutionKey) => onChange({ ...settings, resolutionKey })} />
      <QualitySelect label={named('Quality')} levels={options.qualityLevels} value={settings.quality} onChange={(quality) => onChange({ ...settings, quality })} />
    </fieldset>
  );
}
