import { useEffect } from 'react';
import type { Provider } from '../../keys';
import { Select, type SelectOption } from '../../ui-kit';
import { KNOWN_MODELS, warnAboutStaleKnownModels } from '../catalog/knownModels';
import type { ModelCatalog } from '../generateStore';

export interface ModelSelectProps {
  catalog: ModelCatalog;
  hasKey: Record<Provider, boolean>;
  provider: Provider | null;
  modelId: string | null;
  today: string; // YYYY-MM-DD, for the stale-table warning
  onSelect: (provider: Provider, modelId: string) => void;
}

const PROVIDER_NAME: Record<Provider, string> = { gemini: 'Gemini', openai: 'OpenAI' };
const PROVIDERS_IN_ORDER: Provider[] = ['gemini', 'openai'];

// R4: the image models of the providers that have a key, written "Provider: name"; a model the table does not know is marked unverified.
export function ModelSelect({ catalog, hasKey, provider, modelId, today, onSelect }: ModelSelectProps): React.JSX.Element {
  // The table is checked once when the picker first appears, in development builds only.
  useEffect(() => {
    if (import.meta.env.DEV) warnAboutStaleKnownModels(KNOWN_MODELS, today);
  }, []);

  const options: SelectOption[] = PROVIDERS_IN_ORDER.filter((name) => hasKey[name])
    .flatMap((name) => catalog[name].filter((model) => model.role === 'image').map((model) => ({ value: `${name}:${model.id}`, label: `${PROVIDER_NAME[name]}: ${model.displayName}${model.verified ? '' : ' (unverified)'}` })))
    .sort((a, b) => a.label.localeCompare(b.label));
  const value = provider !== null && modelId !== null ? `${provider}:${modelId}` : '';

  return (
    <Select
      label="Model"
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
