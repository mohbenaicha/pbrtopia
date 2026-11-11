import { useMemo } from 'react';
import { useGenerationPanel, type GenerationPanel, type ProjectEditing } from '@mat/generation';
import type { MapsController, MapsState } from '@mat/maps';
import { newMaterialRecord, type MaterialProjectStore, type MaterialRecord } from '@mat/storage';
import { readMaxTextureSize } from '../capabilities/readBrowserCapabilityEnv';
import { useModelMasksSteps } from './useModelMasksSteps';

type GenerationStore = Pick<MaterialProjectStore, 'readBlob' | 'writeBlob' | 'deleteBlob' | 'loadAppSettings' | 'saveAppSettings'>;

interface Inputs {
  store: GenerationStore;
  projectId: string;
  record: MaterialRecord | null; // null while the project opens
  canWrite: boolean;
  project: ProjectEditing;
  mapsState: MapsState;
  maps: Pick<MapsController, 'placeGenerated' | 'commitMasks'>;
}

const OPENING: MaterialRecord = newMaterialRecord({ id: '', name: '', size: null, now: '' }); // stands in until the record is read, so the hooks below run in one order

/** The generation panel of the open project, built once for the left panel and the setup overlay (generation R1-R70). */
export function useMaterialGeneration({ store, projectId, record, canWrite, project, mapsState, maps }: Inputs): GenerationPanel {
  const maxTextureSize = useMemo(() => readMaxTextureSize(), []);
  const masksSteps = useModelMasksSteps({ record, mapsState, maps });
  return useGenerationPanel({ store, projectId, record: record ?? OPENING, canWrite: canWrite && record !== null, project, mapsState, placeGenerated: maps.placeGenerated, maxTextureSize, masksSteps });
}
