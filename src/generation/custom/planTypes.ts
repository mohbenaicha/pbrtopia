import type { Provider } from '../../keys';
import type { ResolutionKey } from '../catalog/modelTypes';

// Custom generation data model: the plan stores camera indices and settings, never canvases or pixel sizes (R9 derives them).
export const CORE_CAMERA_NAMES: readonly string[] = ['Front', 'Right', 'Back', 'Left', 'Top', 'Bottom'];
export const CORE_CAMERA_COUNT = CORE_CAMERA_NAMES.length;
export const MAX_CORE_SHEETS = 6;

export interface SheetSettings {
  provider: Provider;
  modelId: string;
  resolutionKey: ResolutionKey;
  quality: string | null;
}

export interface CoreSheetPlan {
  cameras: number[]; // core indices 0-5, each at most once in the whole plan, in core order
  settings: SheetSettings;
}

export interface AuxSheetPlan {
  settings: SheetSettings;
}

export interface CustomPlanRecord {
  sheets: CoreSheetPlan[]; // 0 to 6; the first is the lead (R5)
  aux: AuxSheetPlan | null; // null: no aux sheet
}

export interface NamedPlanRecord {
  name: string;
  plan: CustomPlanRecord;
}
