import type { Provider } from '../keys';
import { listCanvases } from './catalog/canvasRules';
import type { ProviderModelRecord } from './catalog/modelTypes';
import { countUserReferenceSlots } from './catalog/referenceSlots';
import { countImages, describePlanProblem } from './custom/planEditing';
import type { SheetSettings } from './custom/planTypes';
import { findCatalogModel, type EnhancerChoice, type GenerateState } from './generateStore';

type AvailabilityInput =Pick<GenerateState, 'hasModel' | 'hasUvs' | 'readOnly' | 'setOpen' | 'setBusy' | 'provider' | 'modelId' | 'catalog' | 'hasKey' | 'enhancer' | 'status' | 'unwrap' | 'mode' | 'customPlan' | 'references'>;

export interface GenerateAvailability {
  action: 'generate' | 'generate-uv';
  enabled: boolean;
  reason: string | null; // why the button is disabled; null when it is enabled
  imageCount?: number; // custom R1: how many images an enabled Generate (custom) requests, for the button's tooltip
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
  if (input.mode === 'custom') return describeCustomAvailability(input, busy);
  if (provider === null || modelId === null) return blocked('generate', 'Choose an image model.');
  const modelProblem = describeImageModelProblem(input, provider, modelId);
  if (modelProblem !== null) return blocked('generate', modelProblem);
  const enhancerProblem = describeEnhancerProblem(input);
  if (enhancerProblem !== null) return blocked('generate', enhancerProblem);
  if (busy) return blocked('generate', 'A request is already running.');
  return { action: 'generate', enabled: true, reason: null };
}

// R19: why an image model cannot be used right now, or null.
export function describeImageModelProblem(input: Pick<AvailabilityInput, 'catalog' | 'hasKey'>, provider: Provider, modelId: string): string | null {
  const image = input.catalog[provider].find((model) => model.id === modelId);
  if (image === undefined) return 'The chosen image model is no longer available. Choose another.';
  if (!image.verified) return 'This image model is not verified yet, so its sizes and quality levels are unknown. Choose another.';
  if (!input.hasKey[provider]) return `Add a ${PROVIDER_NAME[provider]} key in Settings.`;
  return null;
}

// R8, R20: why the prompt enhancer cannot be used right now, or null.
function describeEnhancerProblem(input: Pick<AvailabilityInput, 'enhancer' | 'provider' | 'catalog' | 'hasKey'>): string | null {
  const enhancer = pickEnhancerModel(input);
  if (enhancer === null) return 'Choose a prompt enhancer model in Settings.';
  if (!input.hasKey[enhancer.provider]) return `Add an ${PROVIDER_NAME[enhancer.provider]} key in Settings for the prompt enhancer.`;
  return null;
}

// Custom R7, R13: why one sheet's model cannot serve it, or null: the model and key (generate R19), a canvas at the sheet's resolution, and,
// for a follower, room for its snapshot and the lead's image.
export function describeSheetProblem(input: Pick<AvailabilityInput, 'catalog' | 'hasKey'>, settings: SheetSettings, isLead: boolean): string | null {
  const modelProblem = describeImageModelProblem(input, settings.provider, settings.modelId);
  if (modelProblem !== null) return modelProblem;
  const model = findCatalogModel(input.catalog, settings.provider, settings.modelId);
  if (model?.canvases === undefined || listCanvases(model.canvases, settings.resolutionKey).length === 0) return 'This image model offers no image size for custom generation. Choose another.';
  if (!isLead && model.maxReferenceImages !== undefined && model.maxReferenceImages < 2) return 'This image model takes too few reference images to follow the first image.';
  return null;
}

// Custom R13: the user's references must fit the lead sheet's model.
function describeLeadReferenceProblem(input: Pick<AvailabilityInput, 'catalog' | 'references'>, lead: SheetSettings): string | null {
  const room = countUserReferenceSlots(findCatalogModel(input.catalog, lead.provider, lead.modelId));
  return input.references.length > room ? `Too many reference images for image 1's model (${room} at most).` : null;
}

// Custom R1, R7, R13, R19: Generate (custom) needs a confirmed plan whose every sheet has a camera (the aux sheet none), a listed, verified model
// with a key and a canvas, and references that fit the lead's model.
function describeCustomAvailability(input: AvailabilityInput, busy: boolean): GenerateAvailability {
  const plan = input.customPlan;
  if (plan === null) return blocked('generate', 'Set up the custom generation first.');
  const planProblem = describePlanProblem(plan, (settings, isLead) => describeSheetProblem(input, settings, isLead));
  if (planProblem !== null) return blocked('generate', planProblem);
  const referenceProblem = describeLeadReferenceProblem(input, plan.sheets[0]!.settings); // the plan check above guarantees a first sheet
  if (referenceProblem !== null) return blocked('generate', referenceProblem);
  const enhancerProblem = describeEnhancerProblem(input);
  if (enhancerProblem !== null) return blocked('generate', enhancerProblem);
  if (busy) return blocked('generate', 'A request is already running.');
  return { action: 'generate', enabled: true, reason: null, imageCount: countImages(plan) };
}
