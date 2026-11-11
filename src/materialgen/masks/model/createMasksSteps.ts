import type { PixelImage } from '@mat/workerapi';
import type { Component } from '../describe/parseComponents';
import type { MasksBuild } from '../pipeline/bakeCurrentRows';
import type { BaseMaterialTable } from '../table/baseMaterials';
import { matchBaseMaterials, type Embedder, type MaterialMatch } from '../table/matchMaterials';
import { startMaskJob } from '../worker/startMaskJob';
import { buildDecompositionText } from './buildDecompositionText';
import { runDescribeStep } from './runDescribeStep';
import type { StepOutcome } from './stepOutcome';

/** What the project offers a masks step at the moment it runs. */
interface MasksTarget {
  size: number; // S
  albedoKey: string; // the albedo working file the labels are made from
  feather: number;
}

export interface MasksStepDeps {
  /** One call of the describe model with the albedo reference; answers with the reply text, or the message of the failure (no key, no model, provider error). */
  askDescribe(text: string, image: Blob, signal: AbortSignal): Promise<StepOutcome<string>>;
  loadTable(): Promise<BaseMaterialTable>;
  /** The vector of each material, in the order of the table (masks R75). With the embedder, it turns the match from words to meaning; without either, or when this fails, the keyword match is used (R77). */
  loadVectors?(tableLength: number): Promise<readonly Float32Array[]>;
  embedder?: Embedder;
  /** Read at the time the step runs (the albedo may have just been committed), null when the material has no albedo or size yet. */
  target(): MasksTarget | null;
  /**
   * The components of a describe step that is done while the picture is not (R8a, R8b): saved as soon as the step returns, and used instead of a
   * new call when the material has no masks and they were made from the same albedo. `load` answers null when there are none to use.
   */
  pending?: {
    load(albedoKey: string): ReadonlyArray<Component> | null;
    save(albedoKey: string, components: ReadonlyArray<Component>): Promise<void>;
  };
  /** Places the labels (the picture as their original), the bake and the record in one commit; false when it was not stored. */
  commit(build: MasksBuild, original: PixelImage, albedoKey: string): Promise<boolean>;
}

/** The answer of the describe step, as generation hands it from the describe step to the decomposition image. */
export interface DescribedComponents {
  components: ReadonlyArray<Component>;
}

interface Matching {
  table: BaseMaterialTable;
  matches: MaterialMatch[];
}

export interface ModelMasksSteps {
  describeAlbedo(albedoReference: Blob, userText: string, signal: AbortSignal): Promise<StepOutcome<DescribedComponents>>;
  buildDecompositionPrompt(answer: DescribedComponents): string;
  acceptDecomposition(image: Blob, pixels: PixelImage, answer: DescribedComponents, signal: AbortSignal): Promise<StepOutcome<void>>;
}

const CANCELLED = 'Cancelled.';
const NO_TARGET = 'The material needs an albedo map before its masks can be made.';
const NO_TABLE = 'The material list could not be loaded.';
const NOT_STORED = 'The masks could not be stored.';
const NOT_BUILT = 'The masks could not be built from the picture.';

/** Used when the project gives no embedder: the matching then uses the keyword match of R77 (never reaches this with no vectors). */
const NO_EMBEDDER: Embedder = { embed: async () => { throw new Error('No embedder'); } };

/**
 * Masks R1-R16, R64, R67, R68, R72, R76, R77: the model path as the three steps a run orders. The describe step asks the describe model and at once
 * starts matching the base materials (by meaning with the shipped vectors and embedder, else by keywords) while the decomposition picture is made;
 * accepting the picture uses that matching, makes the labels, the record and the first bake, and commits them together. A step that fails or is
 * cancelled writes nothing.
 */
export function createMasksSteps(deps: MasksStepDeps): ModelMasksSteps {
  const started = new WeakMap<DescribedComponents, Promise<Matching>>();

  async function matchComponents({ components }: DescribedComponents): Promise<Matching> {
    const table = await deps.loadTable();
    let vectors: readonly Float32Array[] | null = null;
    try {
      vectors = (await deps.loadVectors?.(table.length)) ?? null;
    } catch {
      vectors = null; // R77: the keyword match, no error shown
    }
    const texts = components.map((component) => `${component.name} ${component.description}`.trim());
    return { table, matches: await matchBaseMaterials({ texts, table, vectors, embedder: deps.embedder ?? NO_EMBEDDER }) };
  }

  return {
    describeAlbedo: async (albedoReference, userText, signal) => {
      const albedoKey = deps.target()?.albedoKey;
      const reused = albedoKey === undefined ? null : (deps.pending?.load(albedoKey) ?? null);
      let components: ReadonlyArray<Component>;
      if (reused !== null) {
        components = reused; // R8b: the step was done before a reload or a failed picture: no second paid call
      } else {
        const described = await runDescribeStep({ ask: (text) => deps.askDescribe(text, albedoReference, signal), userText, signal });
        if (!described.ok) return described;
        components = described.value;
        if (albedoKey !== undefined && !signal.aborted) await deps.pending?.save(albedoKey, components).catch(() => undefined); // R8a: a failed save only loses the reuse
      }
      const value = { components };
      const matching = matchComponents(value);
      matching.catch(() => undefined); // a failure is reported when the picture is accepted
      started.set(value, matching);
      return { ok: true, value };
    },
    buildDecompositionPrompt: (answer) => buildDecompositionText(answer.components),
    acceptDecomposition: async (_image, pixels, answer, signal) => {
      let matching: Matching;
      try {
        matching = await (started.get(answer) ?? matchComponents(answer));
      } catch {
        return { ok: false, message: NO_TABLE };
      }
      const { table, matches } = matching;
      if (signal.aborted) return { ok: false, message: CANCELLED };
      const target = deps.target();
      if (target === null) return { ok: false, message: NO_TARGET };
      let built: StepOutcome<MasksBuild>;
      try {
        built = await startMaskJob('model', { decomposition: pixels, components: answer.components, matches, table, size: target.size, feather: target.feather }, { signal }); // R24: off the page's thread; Cancel ends the worker
      } catch {
        return { ok: false, message: signal.aborted ? CANCELLED : NOT_BUILT };
      }
      if (signal.aborted) return { ok: false, message: CANCELLED };
      if (!built.ok) return built;
      if (!(await deps.commit(built.value, pixels, target.albedoKey))) return { ok: false, message: NOT_STORED };
      return { ok: true, value: undefined };
    },
  };
}
