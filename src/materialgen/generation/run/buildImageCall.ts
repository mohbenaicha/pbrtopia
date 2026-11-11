import type { GenerateRequest } from '@shared/generation';
import type { Provider } from '@shared/keys';
import { buildDecompositionImagePrompt, buildMapPrompt, type ColorModeName } from '../prompts/buildMapPrompt';
import type { ImageJob } from './runTypes';

/** One request ready to send, with the prompt as the log shows it and the names of the pictures sent (R68). */
export interface ImageCall {
  provider: Provider;
  request: GenerateRequest;
  prompt: string;
  referenceNames: string[];
}

export interface CallInputs {
  userText: string;
  colorMode: ColorModeName;
  references: readonly Blob[]; // the user's reference images, already scaled (R39)
  albedoReference: Blob | null; // from the lead's albedo tile (R6)
  decompositionPrompt: string | null; // the masks prompt (R37), for the decomposition job
}

/**
 * Generation R22, R31, R39: the request of one job. The lead (the image holding Albedo) sends the user's references as the pictures to work from (none: a text-to-image
 * request); every other image sends the albedo reference alone, so with no Albedo in the plan the references are not sent. The canvas is the layout's; the prompt is final, the adapter adds nothing.
 */
export function buildImageCall(job: ImageJob, inputs: CallInputs): ImageCall {
  const { settings } = job;
  const isLead = job.kind === 'map' && job.maps.includes('albedo');
  const prompt =
    job.kind === 'decomposition'
      ? buildDecompositionImagePrompt(inputs.decompositionPrompt ?? '')
      : buildMapPrompt({ maps: job.maps, layout: job.layout, userText: inputs.userText, colorMode: inputs.colorMode, follower: !isLead });
  const images = isLead ? [...inputs.references] : inputs.albedoReference === null ? [] : [inputs.albedoReference];
  const referenceNames = isLead ? inputs.references.map((_, index) => `Reference ${index + 1}`) : images.length > 0 ? ['Albedo reference'] : [];
  const request: GenerateRequest = {
    model: settings.modelId,
    prompt,
    images,
    references: [],
    resolutionKey: settings.resolutionKey,
    sizePx: job.sizePx,
    canvas: job.layout.canvas,
    quality: settings.quality,
  };
  return { provider: settings.provider, request, prompt, referenceNames };
}
