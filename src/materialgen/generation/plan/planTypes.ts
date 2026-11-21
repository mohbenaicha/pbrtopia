import type { SheetSettings } from '@shared/generation';

export type { SheetSettings };

/** Generation R5, R21: the maps a map image can hold, in the reading order of a grid. Albedo is optional like the others; the image holding it is the lead. */
export const PLAN_MAPS = ['albedo', 'height'] as const;
export type PlanMap = (typeof PLAN_MAPS)[number];

/** Generation words: up to two map images; the decomposition card is a third, fixed one (R13). The normal map is not generated: it is computed from the height map (normal-from-height R1). */
export const MAX_MAP_IMAGES = 2;

/** One map image: the maps it holds (in reading order) and its model settings. An image with no map is an empty card (R13). */
export interface MapImagePlan {
  maps: PlanMap[];
  settings: SheetSettings;
}

/** Generation words: the plan stores map names and settings, never pixel sizes (canvases are derived, R22). */
export interface GenerationPlan {
  images: MapImagePlan[]; // 0 to 2; the one holding Albedo, if any, is the lead (R6)
  decomposition: SheetSettings | null; // null: the Metal-Roughness card is not included (R15)
}

/** Generation R2: what the Single map tabs pick: a map, or the Metal-Roughness card alone. */
export type SingleMapChoice = PlanMap | 'metal-roughness';

/** Generation R20: a plan the user saved under a name. */
export interface SavedSetup {
  name: string;
  plan: GenerationPlan;
}

/** Generation R1, R4: the select value of a plan that matches no preset and no saved setup. */
export const CUSTOM_PRESET_ID = 'custom';
