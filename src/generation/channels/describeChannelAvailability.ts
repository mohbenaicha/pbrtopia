export type GenerateChannel = 'albedo' | 'normal' | 'metal-rough';

/** textures R24: the albedo image in force across the model: one override picture, one model image, different ones on different materials, or none. */
export type AlbedoInForce = { kind: 'picture'; id: string } | { kind: 'model'; key: string } | { kind: 'mixed' } | { kind: 'none' };

export interface ChannelAvailability {
  enabled: boolean;
  reason?: string;
}
export type ChannelAvailabilityMap = Record<GenerateChannel, ChannelAvailability>;

export interface ChannelAvailabilityInput {
  hasModel: boolean;
  busy: boolean; // a run, bake or Generate UV is going
  setOpen: boolean; // a projection set is open
  albedoInForce: AlbedoInForce; // textures R24: the albedo image across the model's materials
  sourceIsSquare: boolean | null; // null when there is no source albedo
}

const NO_ALBEDO = 'Bake or apply one albedo to the whole model first.';
const NOT_SQUARE = 'Normal maps need a square albedo picture.';
const BUSY = 'Wait for the current task to finish.';

const blocked = (reason: string): ChannelAvailability => ({ enabled: false, reason });

// normal-map R2, textures R24: Albedo is always on; the generated channels need one albedo image on every material, a generated picture or the model's own.
export function describeChannelAvailability(input: ChannelAvailabilityInput): ChannelAvailabilityMap {
  const albedo: ChannelAvailability = { enabled: true };
  if (input.busy || input.setOpen) return { albedo, normal: blocked(BUSY), 'metal-rough': blocked(BUSY) };
  const hasSource = input.hasModel && (input.albedoInForce.kind === 'picture' || input.albedoInForce.kind === 'model');
  if (!hasSource) return { albedo, normal: blocked(NO_ALBEDO), 'metal-rough': blocked(NO_ALBEDO) };
  return { albedo, normal: input.sourceIsSquare === false ? blocked(NOT_SQUARE) : { enabled: true }, 'metal-rough': { enabled: true } };
}

export interface ChannelPanelFields {
  prompt: boolean;
  references: boolean;
  atlas: boolean;
  customGear: boolean;
  detail: boolean;
  masks: boolean; // mask-generation R2: the prompt is "Describe the materials (optional)", the button "Generate masks"; no atlas render or tile border
}

// normal-map R4: the Normal panel hides everything a projection run needs and shows the Detail slider.
// mask-generation R2: the Metal-Roughness panel keeps the prompt (as the describe field), the atlas size and the Custom setup gear, and hides references.
export function channelPanelFields(channel: GenerateChannel): ChannelPanelFields {
  if (channel === 'normal') return { prompt: false, references: false, atlas: false, customGear: false, detail: true, masks: false };
  if (channel === 'metal-rough') return { prompt: true, references: false, atlas: true, customGear: true, detail: false, masks: true };
  return { prompt: true, references: true, atlas: true, customGear: true, detail: false, masks: false };
}
