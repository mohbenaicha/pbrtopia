import { useCallback, useRef } from 'react';
import { useAppBackends } from '@shared/shell';
import type { DescribeTarget, MasksStepsFactory } from '@mat/generation';
import type { MapsController, MapsState } from '@mat/maps';
import { DEFAULT_FEATHER, createMasksSteps, createWorkerEmbedder, parseDescribedComponents, parseMasksRecord, serializeDescribedComponents, serializeMasksRecord } from '@mat/masks';
import type { MaterialRecord } from '@mat/storage';
import { loadBaseMaterials } from '../panels/masks/loadBaseMaterials';
import { loadMaterialVectors } from '../panels/masks/loadMaterialVectors';
import { askDescribeModel } from './askDescribeModel';
import { buildModelMasksCommit } from './buildModelMasksCommit';

const UNDO_LABEL = 'Material masks';
const embedder = createWorkerEmbedder();

interface Inputs {
  record: MaterialRecord | null;
  mapsState: MapsState;
  maps: Pick<MapsController, 'commitMasks'>;
}

/**
 * Masks R1-R16, R64: the model path bound to the app. The steps read the project at the moment they run (a run commits the albedo first and the
 * state moves on while the provider is called), so the inputs are kept in a ref and the factory is stable across renders.
 */
export function useModelMasksSteps({ record, mapsState, maps }: Inputs): MasksStepsFactory {
  const backends = useAppBackends();
  const latest = useRef({ record, mapsState, maps });
  latest.current = { record, mapsState, maps };
  const { keys, createPromptEnhancer } = backends;

  return useCallback(
    (describe: DescribeTarget | null) =>
      createMasksSteps({
        askDescribe: askDescribeModel({ target: describe, keys, createPromptEnhancer }),
        loadTable: loadBaseMaterials,
        loadVectors: loadMaterialVectors,
        embedder,
        target: () => {
          const { mapsState: state, record: current } = latest.current;
          const colour = state.maps.albedo ?? state.maps.diffuse;
          const albedoKey = colour?.workingKey;
          if (state.size === null || albedoKey === undefined) return null;
          return { size: state.size, albedoKey, feather: parseMasksRecord(current?.masks)?.feather ?? DEFAULT_FEATHER };
        },
        pending: {
          // R8b: only for a material with no masks; R8a: only written then, so a failing run can never put existing rows at risk
          load: (albedoKey) => {
            const masks = latest.current.record?.masks;
            return parseMasksRecord(masks) === null ? parseDescribedComponents(masks, albedoKey) : null;
          },
          save: async (albedoKey, components) => {
            if (parseMasksRecord(latest.current.record?.masks) !== null) return;
            await latest.current.maps.commitMasks({ label: UNDO_LABEL }, serializeDescribedComponents(albedoKey, components));
          },
        },
        commit: (build, original, albedoKey) =>
          latest.current.maps.commitMasks(buildModelMasksCommit(latest.current.mapsState, build, original, albedoKey), serializeMasksRecord(build.record)),
      }),
    [keys, createPromptEnhancer],
  );
}
