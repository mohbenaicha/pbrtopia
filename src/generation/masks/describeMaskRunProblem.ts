import type { ChannelAvailability } from '../channels/describeChannelAvailability';
import type { EnhancerChoice } from '../generateStore';

export const NO_DESCRIBE_MODEL = 'No model can describe the pictures. Add a Gemini or OpenAI key.';

interface MaskRunProblemInput {
  channelAvailability: ChannelAvailability; // the Metal-Roughness entry of the channel map (normal-map R2)
  describeModel: EnhancerChoice | null; // Settings' model, else the automatic one (pickEnhancerModel)
  keyPresent: boolean; // the describe model's provider has a key
}

/** mask-generation R1: why a mask run cannot start, or null. The channel's own reason comes first; then a missing describe model or its key. */
export function describeMaskRunProblem({ channelAvailability, describeModel, keyPresent }: MaskRunProblemInput): string | null {
  if (!channelAvailability.enabled) return channelAvailability.reason ?? null;
  if (describeModel === null || !keyPresent) return NO_DESCRIBE_MODEL;
  return null;
}
