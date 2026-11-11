import { vi } from 'vitest';
import { buildModelCatalog } from '@shared/shell';
import type { Provider } from '@shared/keys';
import { buildCostHint, buildPresetPlan, inspectPlan, type GenerationPanel, type GenerationPlan, type PromptIdeas } from '@mat/generation';
import type { RunSession } from '@mat/generation/ui/useRunSession';
import { listPlanChoices } from '@mat/generation/plan/planChoices';
import { withKnownModels } from '@mat/generation/plan/displayCatalog';

const MAX_TEXTURE = 4096;

export const idleRun = (patch: Partial<RunSession> = {}): RunSession => ({
  running: false,
  progress: null,
  result: null,
  startError: null,
  confirm: null,
  canRetry: false,
  log: [],
  generate: vi.fn(),
  confirmGenerate: vi.fn(),
  dismissConfirm: vi.fn(),
  cancel: vi.fn(),
  retry: vi.fn(),
  generateMasks: vi.fn(),
  runKind: null,
  resultKind: null,
  ...patch,
});

interface FakeOptions {
  keyed?: Provider[];
  presetId?: string;
  plan?: GenerationPlan; // a plan to show instead of the preset's (presetId is then only the select value)
  referenceCount?: number;
  run?: Partial<RunSession>;
  describeProvider?: Provider | null;
  ideas?: Partial<PromptIdeas>;
}

/** An idle generation panel over the shipped model table, with spies for every action. */
export function makeGenerationPanel({ keyed = ['gemini'], presetId = 'preset-1', plan: givenPlan, referenceCount = 0, run = {}, describeProvider = keyed[0] ?? null, ideas = {} }: FakeOptions = {}): GenerationPanel {
  const catalog = buildModelCatalog(keyed);
  const hasKey = { gemini: keyed.includes('gemini'), openai: keyed.includes('openai') };
  const plan = givenPlan ?? buildPresetPlan(presetId, catalog, MAX_TEXTURE)!;
  const environment = { catalog, hasKey, describeProvider, referenceCount, hasExistingAlbedo: false };
  const report = inspectPlan(plan, environment);
  return {
    choice: { plan, saved: [], entry: presetId, choices: listPlanChoices([], presetId), choose: vi.fn(), replacePlan: vi.fn(), saveSetup: vi.fn(), deleteSetup: vi.fn() },
    models: { catalog, hasKey, ready: true },
    displayCatalog: withKnownModels(catalog),
    maxTextureSize: MAX_TEXTURE,
    environment,
    report,
    hint: buildCostHint(inspectPlan(plan, { catalog: withKnownModels(catalog), hasKey: { gemini: true, openai: true }, describeProvider: 'gemini', referenceCount: 0, hasExistingAlbedo: true }), 'albedo', 1024, null),
    references: { references: [], notice: null, addFiles: vi.fn(), remove: vi.fn() },
    run: idleRun(run),
    masksProblem: null,
    ideas: idleIdeas(ideas),
  };
}

export const idleIdeas = (patch: Partial<PromptIdeas> = {}): PromptIdeas => ({
  ideas: [],
  selected: null,
  canReset: false,
  busy: false,
  error: null,
  disabledReason: null,
  request: vi.fn(),
  pick: vi.fn(),
  reset: vi.fn(),
  ...patch,
});
