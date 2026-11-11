import { scaleImageToMaxSide, type ImageGenerator, type ProviderError } from '@shared/generation';
import type { KeyVault, Provider } from '@shared/keys';
import { decodeImageFile, encodePngBlob, type GeneratedMap } from '@mat/maps';
import type { RunPorts } from '../run/runTypes';

/** Generate R29: references are sent at most this long on their longest side (the app-wide setting is not offered in this app yet, so the default). */
export const REFERENCE_MAX_SIDE_PX = 1024;

/** The masks-owned steps of a run (masks R1-R16): the describe step and the hand-over of the decomposition image. */
export type MasksSteps = Pick<RunPorts, 'describeAlbedo' | 'buildDecompositionPrompt' | 'acceptDecomposition'>;

/** The vision-text model the describe step asks (masks R1), with the reasoning level the model table gives it. */
export interface DescribeTarget {
  provider: Provider;
  modelId: string;
  level: string | null;
}

/** Binds the masks steps to the describe model chosen now; called again when the choice changes. */
export type MasksStepsFactory = (describe: DescribeTarget | null) => MasksSteps;

export interface RunBackends {
  createImageGenerator(provider: Provider): ImageGenerator;
  keys: Pick<KeyVault, 'getKey'>;
}

const PROVIDER_NAME: Record<Provider, string> = { gemini: 'Gemini', openai: 'OpenAI' };

const missingKey = (provider: Provider): ProviderError => ({ category: 'auth', retryable: false, message: `Add your ${PROVIDER_NAME[provider]} key in Settings > Keys` });

/** Stands in until the masks model path is bound: the decomposition image then fails with a plain line and the run ends as a partial one (R58). */
export const MASKS_STEPS_UNAVAILABLE: MasksSteps = {
  describeAlbedo: async () => ({ ok: false, message: 'The Metal-Roughness image is not available in this build yet.' }),
  buildDecompositionPrompt: () => '',
  acceptDecomposition: async () => ({ ok: false, message: 'The Metal-Roughness image is not available in this build yet.' }),
};

interface BindInputs {
  backends: RunBackends;
  commitMaps(maps: readonly GeneratedMap[]): Promise<boolean>; // the maps controller's placeGenerated (R42)
  masks: MasksSteps;
}

/** Generation R6, R42, R65: binds a run to the provider adapters (the key is read per call and never kept), the maps controller and the masks steps. */
export function bindRunPorts({ backends, commitMaps, masks }: BindInputs): RunPorts {
  return {
    generateImage: async (provider, request, signal) => {
      const apiKey = backends.keys.getKey(provider);
      if (apiKey === null) return { ok: false, error: missingKey(provider) };
      return backends.createImageGenerator(provider).generate(request, { apiKey, signal });
    },
    decodeImage: async (blob) => {
      try {
        const decoded = await decodeImageFile(new File([blob], 'Returned image', { type: blob.type }));
        return decoded.ok ? decoded.image : null;
      } catch {
        return null;
      }
    },
    makeAlbedoReference: async (tile) => {
      const png = await encodePngBlob(tile); // maps R60
      try {
        const scaled = await scaleImageToMaxSide(png, REFERENCE_MAX_SIDE_PX);
        return scaled.ok ? scaled.value : png;
      } catch {
        return png;
      }
    },
    commitMaps: async (maps) => {
      try {
        return await commitMaps(maps);
      } catch {
        return false; // a failed store is reported as "not stored", never thrown into the run
      }
    },
    ...masks,
    now: () => Date.now(),
  };
}
