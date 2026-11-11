import { vi } from 'vitest';
import type { GenerateRequest, GeneratedImage } from '@shared/generation/providers/ImageGenerator';
import type { ProviderError, Result } from '@shared/generation/providers/providerTypes';
import type { Provider } from '@shared/keys';
import { KNOWN_MODELS } from '@shared/generation/catalog/knownModels';
import type { GeneratedMap, PixelImage } from '@mat/maps';
import { inspectPlan, type PlanEnvironment } from '@mat/generation/plan/inspectPlan';
import { buildPresetPlan, type ModelCatalog } from '@mat/generation/plan/presetPlans';
import type { GenerationPlan } from '@mat/generation/plan/planTypes';
import { buildJobs } from '@mat/generation/run/buildJobs';
import type { DescribeAnswer, ImageJob, RunPorts, StepResult } from '@mat/generation/run/runTypes';

export const CATALOG: ModelCatalog = { gemini: KNOWN_MODELS.filter((model) => model.provider === 'gemini'), openai: KNOWN_MODELS.filter((model) => model.provider === 'openai') };
export const ENVIRONMENT: PlanEnvironment = { catalog: CATALOG, hasKey: { gemini: true, openai: true }, describeProvider: 'openai', referenceCount: 0, hasExistingAlbedo: false };
export const preset = (id: string): GenerationPlan => buildPresetPlan(id, CATALOG, 16384)!;
export const jobsOf = (plan: GenerationPlan, colorMode: 'albedo' | 'diffuse' = 'albedo', env: PlanEnvironment = ENVIRONMENT): ImageJob[] => buildJobs(inspectPlan(plan, env), colorMode);

export const ANSWER: DescribeAnswer = { components: [{ name: 'brick', description: 'red brick', location: 'everywhere' }, { name: 'mortar', description: 'grey', location: 'between' }, { name: 'moss', description: 'green', location: 'low' }] };

/** A pending provider call the test settles by hand. */
export interface PendingCall {
  provider: Provider;
  request: GenerateRequest;
  signal: AbortSignal;
  settle(result: Result<GeneratedImage, ProviderError>): void;
}

const sizes = new WeakMap<Blob, { width: number; height: number }>();

/** A blob standing for a returned image of this size; the fake decoder reads the size back. */
export function fakeImage(width: number, height: number, mimeType = 'image/png'): GeneratedImage {
  const blob = new Blob([`${width}x${height}`], { type: mimeType });
  sizes.set(blob, { width, height });
  return { blob, mimeType };
}

export const solid = (width: number, height: number, value = 120): PixelImage => ({ width, height, channels: 3, data: new Uint8Array(width * height * 3).fill(value) });

export interface Harness {
  ports: RunPorts;
  calls: PendingCall[];
  commits: GeneratedMap[][];
  describeCalls: Array<{ reference: Blob; userText: string }>;
  decompositions: Array<{ pixels: PixelImage }>;
  settleDescribe(result: StepResult<DescribeAnswer>): void;
  callsOf(provider?: Provider): PendingCall[];
  /** Settles the nth pending call with an image of the size its own canvas asks for. */
  answerCanvas(call: PendingCall, mimeType?: string): void;
}

export function createHarness(options: { commitOk?: boolean; acceptDecomposition?: StepResult<void> } = {}): Harness {
  const calls: PendingCall[] = [];
  const commits: GeneratedMap[][] = [];
  const describeCalls: Harness['describeCalls'] = [];
  const decompositions: Harness['decompositions'] = [];
  let settleDescribe: (result: StepResult<DescribeAnswer>) => void = () => undefined;
  let clock = 0;
  const ports: RunPorts = {
    generateImage: (provider, request, signal) =>
      new Promise((resolve) => {
        calls.push({ provider, request, signal, settle: resolve });
      }),
    decodeImage: async (blob) => {
      const size = sizes.get(blob);
      return size === undefined ? null : solid(size.width, size.height);
    },
    makeAlbedoReference: vi.fn(async (tile: PixelImage) => new Blob([`albedo-reference-${tile.width}`], { type: 'image/png' })),
    commitMaps: vi.fn(async (maps: readonly GeneratedMap[]) => {
      commits.push([...maps]);
      return options.commitOk ?? true;
    }),
    describeAlbedo: (reference, userText) =>
      new Promise((resolve) => {
        describeCalls.push({ reference, userText });
        settleDescribe = resolve;
      }),
    buildDecompositionPrompt: () => 'MASKS PROMPT: repaint one flat colour per component',
    acceptDecomposition: vi.fn(async (_blob: Blob, pixels: PixelImage) => {
      decompositions.push({ pixels });
      return options.acceptDecomposition ?? ({ ok: true, value: undefined } as const);
    }),
    now: () => (clock += 10),
  };
  return {
    ports,
    calls,
    commits,
    describeCalls,
    decompositions,
    settleDescribe: (result) => settleDescribe(result),
    callsOf: (provider) => calls.filter((call) => provider === undefined || call.provider === provider),
    answerCanvas: (call, mimeType) => {
      const canvas = call.request.canvas ?? { width: call.request.sizePx, height: call.request.sizePx };
      call.settle({ ok: true, value: fakeImage(canvas.width, canvas.height, mimeType ?? (call.provider === 'gemini' ? 'image/jpeg' : 'image/png')) });
    },
  };
}

/** Lets pending promise callbacks run. */
export const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

export const providerError = (category: ProviderError['category'], retryable = true): ProviderError => ({ category, retryable, message: category === 'quota' ? 'Quota used up.' : 'Something went wrong.' });
