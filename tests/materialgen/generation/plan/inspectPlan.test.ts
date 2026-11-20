import { describe, expect, it } from 'vitest';
import { KNOWN_MODELS } from '@shared/generation/catalog/knownModels';
import { assignMap, setImageSettings, unassignMap } from '@mat/generation/plan/editPlan';
import { buildCardSettings } from '@mat/generation/plan/modelMinimums';
import { inspectMasksRun, inspectPlan, type PlanEnvironment } from '@mat/generation/plan/inspectPlan';
import type { GenerationPlan } from '@mat/generation/plan/planTypes';
import { buildPresetPlan, type ModelCatalog } from '@mat/generation/plan/presetPlans';

const MAX_TEXTURE = 16384;
const full: ModelCatalog = { gemini: KNOWN_MODELS.filter((model) => model.provider === 'gemini'), openai: KNOWN_MODELS.filter((model) => model.provider === 'openai'), openrouter: [] };
const env = (patch: Partial<PlanEnvironment> = {}): PlanEnvironment => ({ catalog: full, hasKey: { gemini: true, openai: true, openrouter: false }, describeProvider: 'openai', referenceCount: 0, hasExistingAlbedo: false, ...patch });
const preset = (id: string) => buildPresetPlan(id, full, MAX_TEXTURE)!;

describe('materialgen/generation R9 R18 R65 R66 keys and models', () => {
  it('R9 a plan whose models are listed and keyed has no problem, and every card has its layout', () => {
    const report = inspectPlan(preset('preset-3'), env());
    expect(report.problem).toBeNull();
    expect(report.cards).toHaveLength(4);
    expect(report.cards.every((card) => card.layout?.ok === true)).toBe(true);
  });

  it('R65 a GPT plan with only a Gemini key says to add the OpenAI key, and preset 1 is fine', () => {
    const geminiOnly = env({ catalog: { gemini: full.gemini, openai: [], openrouter: [] }, hasKey: { gemini: true, openai: false, openrouter: false } });
    expect(inspectPlan(preset('preset-2'), geminiOnly).problem).toBe('Add your OpenAI key in Settings > Keys');
    expect(inspectPlan(preset('preset-1'), { ...geminiOnly, describeProvider: 'gemini' }).problem).toBeNull();
  });

  it('R65 with no key at all, Generate says to add an image model key', () => {
    const none = env({ catalog: { gemini: [], openai: [], openrouter: [] }, hasKey: { gemini: false, openai: false, openrouter: false } });
    expect(inspectPlan(preset('preset-1'), none).problem).toBe('Add an image model key in Settings');
  });

  it('R76 an OpenRouter-only key runs an OpenRouter Albedo card; its model gets a layout, no quality, and the reference limit of its row', () => {
    const model = KNOWN_MODELS.find((candidate) => candidate.provider === 'openrouter')!;
    const catalog: ModelCatalog = { gemini: [], openai: [], openrouter: KNOWN_MODELS.filter((candidate) => candidate.provider === 'openrouter') };
    const only = env({ catalog, hasKey: { gemini: false, openai: false, openrouter: true }, describeProvider: null });
    const plan: GenerationPlan = { images: [{ maps: ['albedo'], settings: buildCardSettings(model, MAX_TEXTURE, 1) }], decomposition: null };
    const report = inspectPlan(plan, only);
    expect(report.problem).toBeNull();
    expect(report.cards[0]!.settings).toMatchObject({ provider: 'openrouter', modelId: model.id, quality: null });
    expect(report.cards[0]!.layout?.ok).toBe(true);
    const tooMany = inspectPlan(plan, { ...only, referenceCount: (model.maxReferenceImages ?? 0) + 1 });
    expect(tooMany.problem).toMatch(/^Too many reference images/);
  });

  it('R76 R65 a plan on an OpenRouter model without an OpenRouter key names OpenRouter, and an OpenRouter-only plan with the decomposition card needs an enhancer', () => {
    const model = KNOWN_MODELS.find((candidate) => candidate.provider === 'openrouter')!;
    const catalog: ModelCatalog = { ...full, openrouter: KNOWN_MODELS.filter((candidate) => candidate.provider === 'openrouter') };
    const settings = buildCardSettings(model, MAX_TEXTURE, 1);
    const plan: GenerationPlan = { images: [{ maps: ['albedo'], settings }], decomposition: null };
    expect(inspectPlan(plan, env({ catalog })).problem).toBe('Add your OpenRouter key in Settings > Keys');
    const withDecomposition: GenerationPlan = { ...plan, decomposition: settings };
    const only = env({ catalog, hasKey: { gemini: false, openai: false, openrouter: true }, describeProvider: null });
    expect(inspectPlan(withDecomposition, only).problem).toBe('Choose a prompt enhancer model in Settings.');
  });

  it('R66 the describe step needs its own provider key when the decomposition card is included, and not otherwise', () => {
    const noOpenai = env({ catalog: { gemini: full.gemini, openai: [], openrouter: [] }, hasKey: { gemini: true, openai: false, openrouter: false }, describeProvider: 'openai' });
    expect(inspectPlan(preset('preset-1'), noOpenai).problem).toBe('Add your OpenAI key in Settings > Keys for the describe step');
    expect(inspectPlan({ ...preset('preset-1'), decomposition: null }, noOpenai).problem).toBeNull();
    expect(inspectPlan(preset('preset-1'), env({ describeProvider: null })).problem).toBe('Choose a prompt enhancer model in Settings.');
  });

  it('R19 R67 a model the catalog no longer lists marks its card, and the plan cannot be confirmed', () => {
    const plan = setImageSettings(preset('preset-1'), 1, { provider: 'gemini', modelId: 'gemini-gone', resolutionKey: '1K', quality: null });
    const report = inspectPlan(plan, env());
    expect(report.cards[1]!.problem).toBe('The chosen image model is no longer available. Choose another.');
    expect(report.problem).toBe('The chosen image model is no longer available. Choose another.');
    expect(report.cards[0]!.problem).toBeNull();
  });

  it('R9 R18 a plan with no Albedo when the project has none says Normal, Height and Metal-Roughness need an Albedo, and it is the first problem', () => {
    const plan = unassignMap(preset('preset-1'), 'albedo');
    expect(inspectPlan(plan, env({ hasExistingAlbedo: false })).problem).toBe('Normal, Height and Metal-Roughness need an Albedo: generate one or drop one in.');
  });

  it('R9 R18 the same plan has no problem when the project already has an Albedo', () => {
    const plan = unassignMap(preset('preset-1'), 'albedo');
    expect(inspectPlan(plan, env({ hasExistingAlbedo: true })).problem).toBeNull();
    expect(inspectPlan({ images: [], decomposition: preset('preset-1').decomposition }, env({ hasExistingAlbedo: true })).problem).toBeNull();
  });

  it('R9 R18 a plan with Albedo needs no existing Albedo', () => {
    expect(inspectPlan(preset('preset-1'), env({ hasExistingAlbedo: false })).problem).toBeNull();
  });

  it('R5 R9 R18 a plan that holds no map and no decomposition card has nothing to generate', () => {
    expect(inspectPlan({ images: [], decomposition: null }, env({ hasExistingAlbedo: true })).problem).toBe('Nothing to generate.');
    const emptied: GenerationPlan = { images: [{ maps: [], settings: preset('preset-1').images[0]!.settings }], decomposition: null };
    expect(inspectPlan(emptied, env({ hasExistingAlbedo: true })).problem).toBe('Nothing to generate.');
  });

  it('R6 R13 the card holding Albedo is the lead whichever image it is: with Albedo on Image 2 that card takes the references and Image 1 takes the albedo', () => {
    const plan = assignMap(preset('preset-1'), 'albedo', 1); // Image 2 holds Albedo and Normal, Image 1 is empty
    const withHeightFirst = assignMap(plan, 'height', 0);
    const report = inspectPlan(withHeightFirst, env({ referenceCount: 40 }));
    expect(report.cards[0]!.problem).toBeNull(); // a follower: no reference limit
    expect(report.cards[1]!.problem).toMatch(/^Too many reference images for image 2's model/);
  });

  it('R39 with no Albedo in the plan the references are not sent, so their number is no problem', () => {
    const plan = unassignMap(preset('preset-1'), 'albedo');
    expect(inspectPlan(plan, env({ referenceCount: 40, hasExistingAlbedo: true })).problem).toBeNull();
  });

  it('R39 a follower whose model takes no reference image cannot follow the albedo, with or without a lead in the plan', () => {
    const noReference = { ...KNOWN_MODELS.find((model) => model.id === 'gpt-image-2.5-sunburst')!, id: 'no-reference', maxReferenceImages: 0 };
    const plan = setImageSettings(unassignMap(preset('preset-2'), 'albedo'), 1, { provider: 'openai', modelId: 'no-reference', resolutionKey: '1K', quality: 'medium' });
    const report = inspectPlan(plan, env({ hasExistingAlbedo: true, catalog: { gemini: full.gemini, openai: [noReference], openrouter: [] } }));
    expect(report.cards[1]!.problem).toBe('This image model takes no reference image, so it cannot follow the albedo.');
  });

  it('R13 an empty card is not a call: it has no layout and no problem even with a missing model', () => {
    const base = assignMap(preset('preset-1'), 'normal', 0);
    const plan = setImageSettings(base, 1, { provider: 'gemini', modelId: 'gemini-gone', resolutionKey: '1K', quality: null });
    const report = inspectPlan(plan, env());
    expect(report.cards[1]!.problem).toBeNull();
    expect(report.cards[1]!.layout).toBeNull();
  });
});

describe('materialgen/generation R25 R39 layouts and references', () => {
  it('R25 three maps on a card whose canvas gives tiles under 256 px are refused with the measure in the message', () => {
    const packed = assignMap(assignMap(preset('preset-2'), 'normal', 0), 'height', 0);
    expect(inspectPlan(packed, env()).cards[0]!.layout?.ok).toBe(true); // GPT at 1K packs three maps in tiles well over 256
    const narrow = { ...KNOWN_MODELS.find((model) => model.id === 'gpt-image-2.5-sunburst')!, id: 'narrow', canvases: { kind: 'list' as const, byResolution: { '1K': [{ width: 600, height: 300 }] } } };
    const small = inspectPlan(setImageSettings(packed, 0, { provider: 'openai', modelId: 'narrow', resolutionKey: '1K', quality: 'medium' }), env({ catalog: { gemini: full.gemini, openai: [narrow], openrouter: [] } }));
    expect(small.cards[0]!.problem).toBe('Too many maps for this size: tiles would be 200 px. Choose a larger size or move a map to another image.');
    expect(small.problem).toBe(small.cards[0]!.problem);
  });

  it('R39 more reference images than Image 1\'s model takes is a problem on the lead', () => {
    const report = inspectPlan(preset('preset-1'), env({ referenceCount: 40 }));
    expect(report.cards[0]!.problem).toMatch(/^Too many reference images for image 1's model \(\d+ at most\)\.$/);
    expect(inspectPlan(preset('preset-1'), env({ referenceCount: 1 })).problem).toBeNull();
  });
});

describe('materialgen/masks R64 the model masks run is inspected on its own', () => {
  const decomposition = preset('preset-3').decomposition!;

  it('R64 a keyed decomposition model and describe model give a card with its layout and no problem', () => {
    const run = inspectMasksRun(decomposition, env());
    expect(run.problem).toBeNull();
    expect(run.card.card).toBe('decomposition');
    expect(run.card.layout?.ok).toBe(true);
  });

  it('R64 no describe model, or no key for it, says why Create masks is off', () => {
    expect(inspectMasksRun(decomposition, env({ describeProvider: null })).problem).toBe('Choose a prompt enhancer model in Settings.');
    expect(inspectMasksRun(decomposition, env({ hasKey: { gemini: true, openai: false, openrouter: false }, describeProvider: 'openai' })).problem).toMatch(/OpenAI key/);
  });

  it('R64 a missing key for the decomposition model comes first', () => {
    const noKey = env({ hasKey: { gemini: false, openai: false, openrouter: false } });
    expect(inspectMasksRun(decomposition, noKey).problem).toMatch(/key/);
  });

  it('R64 a run problem of the plan\'s other cards is not the masks run\'s problem', () => {
    const plan = setImageSettings(preset('preset-3'), 0, { ...preset('preset-3').images[0]!.settings, modelId: 'not-a-model' });
    expect(inspectPlan(plan, env()).problem).not.toBeNull();
    expect(inspectMasksRun(decomposition, env()).problem).toBeNull();
  });
});
