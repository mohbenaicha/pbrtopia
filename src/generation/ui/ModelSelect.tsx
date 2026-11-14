import { useEffect } from 'react';
import type { Provider } from '../../keys';
import { Select, type SelectOption } from '../../ui-kit';
import { KNOWN_MODELS, warnAboutStaleKnownModels } from '../catalog/knownModels';
import type { ModelCatalog } from '../generateStore';
import { arrangeModelOptions } from './arrangeModelOptions';

interface ModelSelectProps {
  catalog: ModelCatalog;
  hasKey: Record<Provider, boolean>;
  provider: Provider | null;
  modelId: string | null;
  today: string; // YYYY-MM-DD, for the stale-table warning
  onSelect: (provider: Provider, modelId: string) => void;
  label?: string; // the field's name; a setup card names its image ("Image 2 model")
}

const PROVIDER_NAME: Record<Provider, string> = { gemini: 'Gemini', openai: 'OpenAI' };
const PROVIDERS_IN_ORDER: Provider[] = ['gemini', 'openai'];

// R4: the image models of the providers that have a key, written "Provider: name"; a model the table does not know is marked unverified.
export function ModelSelect({ catalog, hasKey, provider, modelId, today, onSelect, label = 'Model' }: ModelSelectProps): React.JSX.Element {
  // The table is checked once when the picker first appears, in development builds only.
  useEffect(() => {
    if (import.meta.env.DEV) warnAboutStaleKnownModels(KNOWN_MODELS, today);
  }, []);

  const options: SelectOption[] = arrangeModelOptions(
    PROVIDERS_IN_ORDER.filter((name) => hasKey[name]).flatMap((name) =>
      catalog[name].filter((model) => model.role === 'image').map((model) => ({ provider: name, value: `${name}:${model.id}`, displayName: model.displayName, verified: model.verified, ...(model.deprecated === true ? { deprecated: true } : {}) })),
    ),
    (name, displayName) => `${PROVIDER_NAME[name]}: ${displayName}`,
  );
  const value = provider !== null && modelId !== null ? `${provider}:${modelId}` : '';

  return (
    <Select
      label={label}
      title="The image model that paints the texture; only providers with a saved key are listed."
      options={options}
      value={value}
      emptyText="Add a key in Settings to list models"
      onChange={(next) => {
        const separator = next.indexOf(':');
        onSelect(next.slice(0, separator) as Provider, next.slice(separator + 1));
      }}
    />
  );
}
