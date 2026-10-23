import type { Provider } from '../keys';
import type { ProviderModelRecord } from './catalog/modelTypes';
import type { EnhancerChoice, GenerateState } from './generateStore';

type AvailabilityInput =Pick<GenerateState, 'hasModel' | 'hasUvs' | 'readOnly' | 'setOpen' | 'setBusy' | 'provider' | 'modelId' | 'catalog' | 'hasKey' | 'enhancer' | 'status' | 'unwrap'>;

export interface GenerateAvailability {
  action: 'generate' | 'generate-uv';
  enabled: boolean;
  reason: string | null; // why the button is disabled; null when it is enabled
}

const PROVIDER_NAME: Record<Provider, string> = { gemini: 'Gemini', openai: 'OpenAI' };

// R8: the model that rewrites the prompt: the Settings choice, else the first verified vision-text model of the image provider. Null when there is none.
export function pickEnhancerModel(input: Pick<AvailabilityInput, 'enhancer' | 'provider' | 'catalog'>): EnhancerChoice | null {
  if (input.enhancer !== null) return input.enhancer;
  if (input.provider === null) return null;
  const fallback = input.catalog[input.provider].find((model: ProviderModelRecord) => model.role === 'vision-text' && model.verified);
  return fallback === undefined ? null : { provider: input.provider, modelId: fallback.id };
}

const blocked = (action: GenerateAvailability['action'], reason: string): GenerateAvailability => ({ action, enabled: false, reason });

// R6, R15: whether the Generate button works and, when not, one fixed sentence saying why. The first failing check wins.
export function describeGenerateAvailability(input: AvailabilityInput): GenerateAvailability {
  const busy = input.status === 'running';
  const action = input.hasUvs ? 'generate' : 'generate-uv';
  if (!input.hasModel) return blocked('generate', 'Load a 3D model first.');
  if (input.readOnly) return blocked(action, 'This project is open in another tab.');
  if (input.setOpen) return blocked(action, 'Exit projection mode first.');
  if (input.setBusy) return blocked(action, 'Wait for the current task to finish.');
  // The unwrap sets hasUvs before the viewport shows the new model, so the button stays blocked until the whole unwrap is over.
  if (input.unwrap.status === 'running') return blocked(action, 'UVs are being generated.');
  if (!input.hasUvs) {
    return busy ? blocked('generate-uv', 'A request is already running.') : { action: 'generate-uv', enabled: true, reason: null };
  }
  const { provider, modelId } = input;
  const image = provider === null || modelId === null ? undefined : input.catalog[provider].find((model) => model.id === modelId);
  if (provider === null || modelId === null) return blocked('generate', 'Choose an image model.');
  if (image === undefined) return blocked('generate', 'The chosen image model is no longer available. Choose another.');
  if (!image.verified) return blocked('generate', 'This image model is not verified yet, so its sizes and quality levels are unknown. Choose another.');
  if (!input.hasKey[provider]) return blocked('generate', `Add a ${PROVIDER_NAME[provider]} key in Settings.`);
  const enhancer = pickEnhancerModel(input);
  if (enhancer === null) return blocked('generate', 'Choose a prompt enhancer model in Settings.');
  if (!input.hasKey[enhancer.provider]) return blocked('generate', `Add an ${PROVIDER_NAME[enhancer.provider]} key in Settings for the prompt enhancer.`);
  if (busy) return blocked('generate', 'A request is already running.');
  return { action: 'generate', enabled: true, reason: null };
}
