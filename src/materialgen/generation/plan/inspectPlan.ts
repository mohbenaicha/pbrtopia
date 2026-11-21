import type { Provider } from '@shared/keys';
import { describeImageModelProblem, type ProviderModelRecord } from '@shared/generation';
import { chooseLayout, type LayoutChoice } from '../layout/chooseLayout';
import type { ModelCatalog } from './presetPlans';
import type { GenerationPlan, PlanMap, SheetSettings } from './planTypes';

export interface PlanEnvironment {
  catalog: ModelCatalog;
  hasKey: Record<Provider, boolean>;
  describeProvider: Provider | null; // the vision-text model of the describe step (masks R1); null when none is chosen
  referenceCount: number; // the user's reference images (R39)
  hasExistingAlbedo: boolean; // the project has an Albedo or Diffuse working map, the albedo reference of a plan with no Albedo (R6)
}

/** One card of the plan as the overlay and the run see it. */
export interface CardReport {
  card: number | 'decomposition'; // index in plan.images, or the decomposition card
  maps: PlanMap[]; // empty for the decomposition card and for an empty card
  settings: SheetSettings;
  model: ProviderModelRecord | null;
  layout: LayoutChoice | null; // null when the model has no canvas rule or the card is empty
  problem: string | null; // R67
}

export interface PlanReport {
  cards: CardReport[];
  problem: string | null; // the first problem in the order Generate (R9) and Confirm (R18) report it
}

/** R9: why a plan with no Albedo cannot run in a project that has none. */
export const NEEDS_ALBEDO_PROBLEM = 'Height and Metal-Roughness need an Albedo: generate one or drop one in.';

const PROVIDER_NAME: Record<Provider, string> = { gemini: 'Gemini', openai: 'OpenAI', openrouter: 'OpenRouter' };

const keyProblem = (provider: Provider): string => `Add your ${PROVIDER_NAME[provider]} key in Settings > Keys`;

/** R25: why a card has no valid layout, or null (the overlay's preview shows it in place of the canvas). */
export function describeLayoutProblem(layout: LayoutChoice): string | null {
  if (layout.ok) return null;
  if (layout.reason === 'tiles-too-small') return `Too many maps for this size: tiles would be ${layout.tileSide} px. Choose a larger size or move a map to another image.`;
  if (layout.reason === 'too-many-maps') return 'Too many maps for one image. Move a map to another image.';
  return 'This image model offers no image size at this resolution. Choose another.';
}

function inspectCard(card: CardReport['card'], maps: PlanMap[], settings: SheetSettings, env: PlanEnvironment, role: 'lead' | 'follower'): CardReport {
  const model = env.catalog[settings.provider].find((candidate) => candidate.id === settings.modelId) ?? null;
  const report: CardReport = { card, maps, settings, model, layout: null, problem: null };
  if (card !== 'decomposition' && maps.length === 0) return report; // R13: an empty card is not a call, so it has no problem
  if (!env.hasKey[settings.provider]) return { ...report, problem: keyProblem(settings.provider) };
  const modelProblem = describeImageModelProblem(env, settings.provider, settings.modelId);
  if (modelProblem !== null || model === null) return { ...report, problem: modelProblem ?? 'The chosen image model is no longer available. Choose another.' };
  const layout = chooseLayout(model.canvases, settings.resolutionKey, Math.max(1, maps.length));
  const layoutProblem = describeLayoutProblem(layout);
  if (layoutProblem !== null) return { ...report, layout, problem: layoutProblem };
  // R39: the lead (the image holding Albedo) takes the user's references (the albedo reference is not one of them); every other image takes the albedo reference.
  if (role === 'lead') {
    const room = model.maxReferenceImages === undefined ? Infinity : model.maxReferenceImages;
    if (env.referenceCount > room) return { ...report, layout, problem: `Too many reference images for image ${Number(card) + 1}'s model (${room} at most).` };
  } else if (model.maxReferenceImages !== undefined && model.maxReferenceImages < 1) {
    return { ...report, layout, problem: 'This image model takes no reference image, so it cannot follow the albedo.' };
  }
  return { ...report, layout };
}

/**
 * Generation R9, R18, R19, R25, R39, R65-R67: every card of a plan with its layout and its own problem, and the first problem overall. Nothing to generate and a plan
 * that needs an Albedo it does not have come first, then the cards in order, the decomposition card, and the describe step's key. A plan with no key at all says so in
 * one sentence. The lead is the card holding Albedo, whichever image it is (R6).
 */
export function inspectPlan(plan: GenerationPlan, env: PlanEnvironment): PlanReport {
  const cards: CardReport[] = plan.images.map((image, index) => inspectCard(index, image.maps, image.settings, env, image.maps.includes('albedo') ? 'lead' : 'follower'));
  if (plan.decomposition !== null) cards.push(inspectCard('decomposition', [], plan.decomposition, env, 'follower'));

  let problem: string | null = null;
  const holdsAlbedo = plan.images.some((image) => image.maps.includes('albedo'));
  const holdsNothing = plan.decomposition === null && !plan.images.some((image) => image.maps.length > 0);
  if (!Object.values(env.hasKey).some(Boolean)) problem = 'Add an image model key in Settings';
  else if (holdsNothing) problem = 'Nothing to generate.';
  else if (!holdsAlbedo && !env.hasExistingAlbedo) problem = NEEDS_ALBEDO_PROBLEM;
  else problem = cards.find((card) => card.problem !== null)?.problem ?? null;
  if (problem === null && plan.decomposition !== null) problem = describeStepProblem(env);
  return { cards, problem };
}

/** Masks R1, R64: why the describe step cannot run (no vision-text model chosen, or no key for its provider), or null. */
function describeStepProblem(env: PlanEnvironment): string | null {
  if (env.describeProvider === null) return 'Choose a prompt enhancer model in Settings.';
  return env.hasKey[env.describeProvider] ? null : `${keyProblem(env.describeProvider)} for the describe step`;
}

/**
 * Masks R64: the model masks run is the describe step and the decomposition image alone. Its card is the decomposition card, its problem the card's
 * own (key, model, layout) or else the describe step's; the plan's other cards do not matter to it.
 */
export function inspectMasksRun(decomposition: SheetSettings, env: PlanEnvironment): { card: CardReport; problem: string | null } {
  const card = inspectCard('decomposition', [], decomposition, env, 'follower');
  return { card, problem: card.problem ?? describeStepProblem(env) };
}
