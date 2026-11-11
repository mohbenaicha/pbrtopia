import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SelectOption } from '@shared/ui-kit';
import type { MaterialProjectStore, MaterialRecord } from '@mat/storage';
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
  record: Pick<MaterialRecord, 'customPlan' | 'presetId'>;
  catalog: ModelCatalog;
  maxTextureSize: number;
  onEdit: EditRecord;
  store: Pick<MaterialProjectStore, 'loadAppSettings' | 'saveAppSettings'>; // the saved setups live in the app settings, shared by every project (R20)
}

/**
 * Generation R1, R2, R4, R20, R70: the plan in force with its select value, saved in the record on every change (the plan always in `customPlan`, the value in `presetId`).
 * The saved setups are not in the record: they are one app-wide list in the settings, loaded once and rewritten on every save and delete.
 */
export function usePlanChoice({ record, catalog, maxTextureSize, onEdit, store }: Inputs): PlanChoice {
  const [saved, setSaved] = useState<SavedSetup[]>([]);
  const listed = useRef<SavedSetup[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    queue.current = store.loadAppSettings().then(
      (settings) => {
        listed.current = parseSavedSetups(settings.savedSetups);
        setSaved(listed.current);
      },
      () => undefined, // settings that cannot be read leave the list empty
    );
  }, [store]);
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

  // R20: every change is applied in turn to the list as it stands, after the first load, so two quick saves both land and none drops the stored setups.
  const change = useCallback(
    (update: (list: SavedSetup[]) => SavedSetup[]) => {
      queue.current = queue.current.then(async () => {
        const next = update(listed.current);
        listed.current = next;
        setSaved(next);
        await store.saveAppSettings({ savedSetups: writeSavedSetups(next) });
      });
    },
    [store],
  );
  const saveSetup = useCallback(
    (name: string, next: GenerationPlan) =>
      change((list) => (list.some((setup) => setup.name === name) ? list.map((setup) => (setup.name === name ? { name, plan: next } : setup)) : [...list, { name, plan: next }])), // a replaced setup keeps its place
    [change],
  );
  const deleteSetup = useCallback((name: string) => change((list) => list.filter((setup) => setup.name !== name)), [change]);

  return { plan, saved, entry, choices, choose, replacePlan, saveSetup, deleteSetup };
}
