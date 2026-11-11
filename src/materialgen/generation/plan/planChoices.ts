import type { RawRecord } from '@shared/projects';
import type { SelectOption } from '@shared/ui-kit';
import { parseStoredPlan } from './planRecord';
import { buildPresetPlan, describePreset, describePresetHint, PRESET_IDS, savedSetupValue, type ModelCatalog } from './presetPlans';
import { CUSTOM_PRESET_ID, type GenerationPlan, type SavedSetup } from './planTypes';

const SAVED_PREFIX = 'saved:';

/** Generation R1: the Preset select's rows: the presets under "Presets", the saved setups under "Saved setups", and Custom only while the plan matches none of them. */
export function listPlanChoices(saved: readonly SavedSetup[], entry: string): SelectOption[] {
  const options: SelectOption[] = PRESET_IDS.map((id) => ({ value: id, label: describePreset(id), hint: describePresetHint(id) ?? '', group: 'Presets' }));
  for (const setup of saved) options.push({ value: savedSetupValue(setup.name), label: setup.name, group: 'Saved setups' });
  if (entry === CUSTOM_PRESET_ID) options.push({ value: CUSTOM_PRESET_ID, label: 'Custom' });
  return options;
}

/** R2, R20: the plan a select value stands for; null for Custom and for a name that is no longer saved (choosing Custom changes nothing). */
export function resolvePlanChoice(value: string, saved: readonly SavedSetup[], catalog: ModelCatalog, maxTextureSize: number): GenerationPlan | null {
  if (value.startsWith(SAVED_PREFIX)) return saved.find((setup) => savedSetupValue(setup.name) === value)?.plan ?? null;
  return buildPresetPlan(value, catalog, maxTextureSize);
}

/** R70: the plan in force: the stored one, else the preset the record names, else preset 1 (a project with no saved plan starts there). */
export function readActivePlan(stored: { customPlan?: RawRecord; presetId: string }, catalog: ModelCatalog, maxTextureSize: number): GenerationPlan {
  return parseStoredPlan(stored.customPlan) ?? buildPresetPlan(stored.presetId, catalog, maxTextureSize) ?? buildPresetPlan(PRESET_IDS[0]!, catalog, maxTextureSize)!;
}
