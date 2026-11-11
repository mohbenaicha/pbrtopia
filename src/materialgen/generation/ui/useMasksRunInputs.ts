import { useCallback, useMemo, useRef } from 'react';
import { findCatalogModel } from '@shared/generation';
import { readMapPixels, type MapsState } from '@mat/maps';
import type { MaterialProjectStore } from '@mat/storage';
import { buildCardSettings } from '../plan/modelMinimums';
import { inspectMasksRun, type PlanEnvironment } from '../plan/inspectPlan';
import { setDecompositionIncluded } from '../plan/editPlan';
import type { GenerationPlan } from '../plan/planTypes';
import type { RunPorts } from '../run/runTypes';
import type { MasksRunInputs } from './useRunSession';

interface Inputs {
  store: Pick<MaterialProjectStore, 'readBlob'>;
  projectId: string;
  plan: GenerationPlan;
  environment: PlanEnvironment;
  maxTextureSize: number;
  mapsState: MapsState;
  makeAlbedoReference: RunPorts['makeAlbedoReference'];
}

/**
 * Masks R13, R64: what the masks-only run needs. It uses the plan's decomposition card, or, while the Metal-Roughness card is not included, the
 * lead image's model with that model's own default settings. Its problem is the card's own or the describe step's, never another card's.
 */
export function useMasksRunInputs({ store, projectId, plan, environment, maxTextureSize, mapsState, makeAlbedoReference }: Inputs): { masksRun: MasksRunInputs; problem: string | null } {
  const latest = useRef({ mapsState, store, projectId, makeAlbedoReference });
  latest.current = { mapsState, store, projectId, makeAlbedoReference };

  const masksPlan = useMemo<GenerationPlan>(() => {
    if (plan.decomposition !== null) return plan;
    const lead = plan.images[0]?.settings;
    if (lead === undefined) return plan;
    const model = findCatalogModel(environment.catalog, lead.provider, lead.modelId);
    return setDecompositionIncluded(plan, true, model === null ? lead : buildCardSettings(model, maxTextureSize, 1));
  }, [plan, environment.catalog, maxTextureSize]);

  const inspected = useMemo(() => (masksPlan.decomposition === null ? null : inspectMasksRun(masksPlan.decomposition, environment)), [masksPlan, environment]);

  const readAlbedoReference = useCallback(async (): Promise<Blob | null> => {
    const { mapsState: state, store: source, projectId: id } = latest.current;
    const key = (state.maps.albedo ?? state.maps.diffuse)?.workingKey;
    if (key === undefined) return null;
    const pixels = await readMapPixels(await source.readBlob(id, key));
    return pixels === null ? null : latest.current.makeAlbedoReference(pixels);
  }, []);

  const masksRun = useMemo<MasksRunInputs>(
    () => ({ plan: masksPlan, report: { cards: inspected === null ? [] : [inspected.card], problem: inspected?.problem ?? null }, readAlbedoReference }),
    [masksPlan, inspected, readAlbedoReference],
  );
  return { masksRun, problem: inspected?.problem ?? 'No image model is chosen.' };
}
