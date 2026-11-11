import { useEffect, useState } from 'react';
import { pickEnhancerModel, type EnhancerChoice } from '@shared/generation';
import type { Provider } from '@shared/keys';
import type { MaterialProjectStore } from '@mat/storage';
import type { ModelCatalog } from '../plan/presetPlans';

/**
 * Generation R66, masks R1: the vision-text model of the describe step: the choice in Settings > Models (the same one the prompt enhancer uses), else Automatic: GPT-6 Luna
 * when an OpenAI key exists, else Gemini 3.8 Flash when a Gemini key exists. Null while the settings load, and when no key exists.
 */
export function useDescribeModel(store: Pick<MaterialProjectStore, 'loadAppSettings'>, catalog: ModelCatalog, leadProvider: Provider | null, hasKey: Record<Provider, boolean>): EnhancerChoice | null {
  const [chosen, setChosen] = useState<EnhancerChoice | null>(null);

  useEffect(() => {
    let current = true;
    void store.loadAppSettings().then(
      (settings) => {
        if (current) setChosen(settings.enhancer);
      },
      () => undefined, // unreadable settings leave the lead provider's default in force
    );
    return () => {
      current = false;
    };
  }, [store]);

  return pickEnhancerModel({ enhancer: chosen, provider: leadProvider, catalog, hasKey });
}
