import { useCallback, useMemo } from 'react';
import type { SelectOption } from '@shared/ui-kit';
import type { MaterialRecord } from '@mat/storage';
import { listPlanChoices, readActivePlan, resolvePlanChoice } from '../plan/planChoices';
import { parseSavedSetups, writePlan, writeSavedSetups } from '../plan/planRecord';
import { detectPlanEntry, type ModelCatalog } from '../plan/presetPlans';
import type { GenerationPlan, SavedSetup } from '../plan/planTypes';

type EditRecord = (change: (record: MaterialRecord) => MaterialRecord) => void;

export interface PlanChoice {
  plan: GenerationPlan;
  saved: SavedSetup[];
  entry: string; // the Preset select's value (R1, R4)
  choices: SelectOption[];
  choose(value: string): void; // R2, R20: a preset or saved setup replaces the plan
  replacePlan(plan: GenerationPlan): void; // R4: an edited plan; the select then shows what it matches, or Custom
  saveSetup(name: string, plan: GenerationPlan): void; // R20: stores the plan under the name, replacing a setup of that name
  deleteSetup(name: string): void; // R20
}

interface Inputs {
  record: Pick<MaterialRecord, 'customPlan' | 'presetId' | 'savedSetups'>;
  catalog: ModelCatalog;
  maxTextureSize: number;
  onEdit: EditRecord;
}

/** Generation R1, R2, R4, R20, R70: the plan in force with its select value, saved in the record on every change (the plan always in `customPlan`, the value in `presetId`). */
export function usePlanChoice({ record, catalog, maxTextureSize, onEdit }: Inputs): PlanChoice {
  const saved = useMemo(() => parseSavedSetups(record.savedSetups), [record.savedSetups]);
  const plan = useMemo(() => readActivePlan(record, catalog, maxTextureSize), [record.customPlan, record.presetId, catalog, maxTextureSize]);
  const entry = useMemo(() => detectPlanEntry(plan, saved, catalog, maxTextureSize), [plan, saved, catalog, maxTextureSize]);
  const choices = useMemo(() => listPlanChoices(saved, entry), [saved, entry]);

  const replacePlan = useCallback(
    (next: GenerationPlan) => {
      const nextEntry = detectPlanEntry(next, saved, catalog, maxTextureSize);
      onEdit((current) => ({ ...current, customPlan: writePlan(next), presetId: nextEntry }));
    },
    [saved, catalog, maxTextureSize, onEdit],
  );

  const choose = useCallback(
    (value: string) => {
      const next = resolvePlanChoice(value, saved, catalog, maxTextureSize);
      if (next !== null) replacePlan(next);
    },
    [saved, catalog, maxTextureSize, replacePlan],
  );

  // R20: read from the record being edited, so two quick saves both land.
  const saveSetup = useCallback(
    (name: string, next: GenerationPlan) => {
      onEdit((current) => {
        const existing = parseSavedSetups(current.savedSetups);
        const replaced = existing.some((setup) => setup.name === name);
        const list = replaced ? existing.map((setup) => (setup.name === name ? { name, plan: next } : setup)) : [...existing, { name, plan: next }];
        return { ...current, savedSetups: writeSavedSetups(list) }; // a replaced setup keeps its place in the list
      });
    },
    [onEdit],
  );
  const deleteSetup = useCallback(
    (name: string) => onEdit((current) => ({ ...current, savedSetups: writeSavedSetups(parseSavedSetups(current.savedSetups).filter((setup) => setup.name !== name)) })),
    [onEdit],
  );

  return { plan, saved, entry, choices, choose, replacePlan, saveSetup, deleteSetup };
}
