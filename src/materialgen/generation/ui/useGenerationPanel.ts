import { useCallback, useMemo } from 'react';
import type { StoreResult } from '@shared/projects';
import { findCatalogModel } from '@shared/generation';
import { useAppBackends } from '@shared/shell';
import type { GeneratedMap, MapsState } from '@mat/maps';
import type { MaterialProjectStore, MaterialRecord } from '@mat/storage';
import { buildCostHint, type CostHint } from '../cost/buildCostHint';
import { withKnownModels } from '../plan/displayCatalog';
import { inspectPlan, type PlanEnvironment, type PlanReport } from '../plan/inspectPlan';
import type { ModelCatalog } from '../plan/presetPlans';
import { usePromptIdeas, type PromptIdeas } from '../ideas/usePromptIdeas';
import { bindRunPorts, type DescribeTarget, type MasksStepsFactory } from './bindRunPorts';
import { useDescribeModel } from './useDescribeModel';
import { useModelCatalogFeed, type ModelCatalogFeed } from './useModelCatalogFeed';
import { usePlanChoice, type PlanChoice } from './usePlanChoice';
import { useReferenceImages, type ReferenceImages } from './useReferenceImages';
import { useMasksRunInputs } from './useMasksRunInputs';
import { useRunSession, type RunSession } from './useRunSession';

/** What the panel needs of the open project (the app's `OpenMaterial` has it). */
export interface ProjectEditing {
  edit(change: (record: MaterialRecord) => MaterialRecord): void;
  commit(change: (record: MaterialRecord) => MaterialRecord): Promise<StoreResult<void>>;
  whenSwept(): Promise<void>;
}

export interface GenerationPanel {
  choice: PlanChoice;
  models: ModelCatalogFeed;  displayCatalog: ModelCatalog; // the real catalog, with the shipped table for providers that have no key (the fields and the hint read it)
  maxTextureSize: number;
  environment: PlanEnvironment; // what inspecting any plan needs: the setup overlay inspects its draft with it
  report: PlanReport; // every card of the plan with its layout and problem
  hint: CostHint; // R62
  references: ReferenceImages;
  run: RunSession;
  masksProblem: string | null; // masks R64: why Create masks cannot run now (the describe step or the decomposition model), or null
  ideas: PromptIdeas; // R71-R75: the Prompt field's ideas strip
}

interface Inputs {
  store: Pick<MaterialProjectStore, 'readBlob' | 'writeBlob' | 'deleteBlob' | 'loadAppSettings' | 'saveAppSettings'>;
  projectId: string;
  record: MaterialRecord;
  canWrite: boolean;
  project: ProjectEditing;
  mapsState: MapsState;
  placeGenerated(maps: readonly GeneratedMap[]): Promise<boolean>; // R42
  maxTextureSize: number;
  masksSteps: MasksStepsFactory; // masks R1-R16: the describe step and the hand-over of the decomposition image, bound by the app
  beforeDecomposition?: () => Promise<void>; // masks-package R6: the app's question before a metal-roughness run
}

/** Materialgen generation: everything the left panel's Preset, Generate, Model settings and Reference images parts show, built from the record, the key vault and the maps. */
export function useGenerationPanel({ store, projectId, record, canWrite, project, mapsState, placeGenerated, maxTextureSize, masksSteps, beforeDecomposition }: Inputs): GenerationPanel {
  const backends = useAppBackends();
  const models = useModelCatalogFeed();
  const choice = usePlanChoice({ record, catalog: models.catalog, maxTextureSize, onEdit: project.edit, store });
  const references = useReferenceImages({ store, projectId, keys: record.referenceImages, canWrite, whenSwept: project.whenSwept, commit: project.commit });
  const describeModel = useDescribeModel(store, models.catalog, (choice.plan.images[0]?.settings ?? choice.plan.decomposition)?.provider ?? null, models.hasKey);
  const hasExistingAlbedo = (mapsState.maps.albedo ?? mapsState.maps.diffuse) !== undefined; // R6: the albedo reference of a plan with no Albedo

  const environment = useMemo<PlanEnvironment>(
    () => ({ catalog: models.catalog, hasKey: models.hasKey, describeProvider: describeModel?.provider ?? null, referenceCount: references.references.length, hasExistingAlbedo }),
    [models.catalog, models.hasKey, describeModel, references.references.length, hasExistingAlbedo],
  );
  const report = useMemo(() => inspectPlan(choice.plan, environment), [choice.plan, environment]);
  const displayCatalog = useMemo(() => withKnownModels(models.catalog), [models.catalog]);
  // R62: the hint reads the plan as if every key existed, so it shows its images and prices before any key is added; it never gates Generate.
  const hint = useMemo(() => {
    const preview = inspectPlan(choice.plan, { catalog: displayCatalog, hasKey: { gemini: true, openai: true }, describeProvider: describeModel?.provider ?? null, referenceCount: 0, hasExistingAlbedo: true });
    return buildCostHint(preview, record.colorMode, record.size, describeModel?.modelId ?? null);
  }, [choice.plan, displayCatalog, describeModel, record.colorMode, record.size]);
  const referenceBlobs = useMemo(() => references.references.map((reference) => reference.blob), [references.references]);
  const describeTarget = useMemo<DescribeTarget | null>(
    () => (describeModel === null ? null : { provider: describeModel.provider, modelId: describeModel.modelId, level: findCatalogModel(models.catalog, describeModel.provider, describeModel.modelId)?.enhancerLevel ?? null }),
    [describeModel, models.catalog],
  );
  const ports = useMemo(
    () => bindRunPorts({ backends: { createImageGenerator: backends.createImageGenerator, keys: backends.keys }, commitMaps: placeGenerated, masks: masksSteps(describeTarget) }),
    [backends, placeGenerated, masksSteps, describeTarget],
  );

  const masks = useMasksRunInputs({ store, projectId, plan: choice.plan, environment, maxTextureSize, mapsState, makeAlbedoReference: ports.makeAlbedoReference });

  const run = useRunSession({
    masksRun: masks.masksRun,
    readAlbedoReference: masks.masksRun.readAlbedoReference,
    ...(beforeDecomposition === undefined ? {} : { beforeDecomposition }),
    plan: choice.plan,
    report,
    planSummary: hint.summary,
    prompt: record.prompt,
    colorMode: record.colorMode,
    materialSize: record.size,
    references: referenceBlobs,
    mapsState,
    ports,
    keys: backends.keys,
  });

  const setPrompt = useCallback((prompt: string) => project.edit((current) => ({ ...current, prompt })), [project]);
  const ideas = usePromptIdeas({ prompt: record.prompt, setPrompt, target: describeTarget, backends: { createPromptEnhancer: backends.createPromptEnhancer, keys: backends.keys } });

  return { choice, models, displayCatalog, maxTextureSize, environment, report, hint, references, run, masksProblem: masks.problem, ideas };
}
