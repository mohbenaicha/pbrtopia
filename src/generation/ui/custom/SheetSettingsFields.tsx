import type { Provider } from '../../../keys';
import { optionsForModel } from '../../catalog/optionsForModel';
import type { SheetSettings } from '../../custom/planTypes';
import { retargetSettings } from '../../custom/sheetSettings';
import { findCatalogModel, type ModelCatalog } from '../../generateStore';
import { ModelSelect } from '../ModelSelect';
import { QualitySelect } from '../QualitySelect';
import { ResolutionSelect } from '../ResolutionSelect';

export interface SheetSettingsFieldsProps {
  name: string; // "Image 2" or "Auxiliary": prefixes the fields' names
  settings: SheetSettings;
  catalog: ModelCatalog;
  hasKey: Record<Provider, boolean>;
  maxTextureSize: number;
  today: string;
  onChange: (settings: SheetSettings) => void;
}

// Custom R5: the model, resolution and quality of one image, with the same lists and rules as the Generate tab (generate R16, R21).
export function SheetSettingsFields({ name, settings, catalog, hasKey, maxTextureSize, today, onChange }: SheetSettingsFieldsProps): React.JSX.Element {
  const model = findCatalogModel(catalog, settings.provider, settings.modelId);
  const options = model === null ? { resolutions: [], qualityLevels: [] } : optionsForModel(model, maxTextureSize);
  return (
    <div className="setup-card__fields">
      <ModelSelect
        label={`${name} model`}
        catalog={catalog}
        hasKey={hasKey}
        provider={settings.provider}
        modelId={settings.modelId}
        today={today}
        onSelect={(provider, modelId) => {
          const next = findCatalogModel(catalog, provider, modelId);
          if (next !== null) onChange(retargetSettings(settings, next, maxTextureSize));
        }}
      />
      <ResolutionSelect label={`${name} resolution`} options={options.resolutions} experimental={model?.experimentalResolutions ?? []} value={settings.resolutionKey} onChange={(resolutionKey) => onChange({ ...settings, resolutionKey })} />
      <QualitySelect label={`${name} quality`} levels={options.qualityLevels} value={settings.quality} onChange={(quality) => onChange({ ...settings, quality })} />
    </div>
  );
}
