import type { SheetSettings } from '@shared/generation';

export type { SheetSettings };

/** Generation R5, R21: the maps a map image can hold, in the reading order of a grid. Albedo is always in Image 1. */
export const PLAN_MAPS = ['albedo', 'normal', 'height'] as const;
export type PlanMap = (typeof PLAN_MAPS)[number];

/** Generation words: up to three map images; the decomposition card is a fourth, fixed one (R13). */
export const MAX_MAP_IMAGES = 3;

/** One map image: the maps it holds (in reading order) and its model settings. An image with no map is an empty card (R13). */
export interface MapImagePlan {
  maps: PlanMap[];
  settings: SheetSettings;
}

/** Generation words: the plan stores map names and settings, never pixel sizes (canvases are derived, R22). */
export interface GenerationPlan {
  images: MapImagePlan[]; // 1 to 3; the first is the lead and holds Albedo
  decomposition: SheetSettings | null; // null: the Metal-Roughness card is not included (R15)
}

/** Generation R20: a plan the user saved under a name. */
export interface SavedSetup {
  name: string;
  plan: GenerationPlan;
}

/** Generation R1, R4: the select value of a plan that matches no preset and no saved setup. */
export const CUSTOM_PRESET_ID = 'custom';
