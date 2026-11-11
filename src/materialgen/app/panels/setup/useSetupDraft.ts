import { useMemo, useState } from 'react';
import { findCatalogModel } from '@shared/generation';
import {
  addImage, assignMap, buildCardSettings, inspectPlan, removeImage, retargetCardSettings, setDecompositionIncluded, setDecompositionSettings, setImageSettings, syncSettings, unassignMap,
  type GenerationPlan, type ModelCatalog, type PlanEnvironment, type PlanMap, type PlanReport, type SheetSettings,
} from '@mat/generation';

export type CardRef = number | 'decomposition';

export interface SetupDraft {
  plan: GenerationPlan;
  report: PlanReport; // the draft inspected as Confirm judges it (generation R18)
  sync: boolean;
  setSync(on: boolean): void; // R17: turning it on copies the lead card's settings to every card
  assign(map: PlanMap, image: number): void;
  unassign(map: PlanMap): void;
  addCard(): void;
  removeCard(image: number): void;
  changeCard(card: CardRef, settings: SheetSettings): void; // R16, R17
  setIncluded(included: boolean): void; // R15
  load(plan: GenerationPlan): void;
}

interface Inputs {
  start: GenerationPlan;
  environment: PlanEnvironment;
  displayCatalog: ModelCatalog; // the lists the fields offer; a synced card takes its model from here
  maxTextureSize: number;
}

/** Generation R11, R13, R15-R17: the copy of the plan the overlay edits; nothing reaches the project until Confirm. Sync is off at first (R17). */
export function useSetupDraft({ start, environment, displayCatalog, maxTextureSize }: Inputs): SetupDraft {
  const [plan, setPlan] = useState<GenerationPlan>(start);
  const [sync, setSyncOn] = useState(false);
  const report = useMemo(() => inspectPlan(plan, environment), [plan, environment]);

  // R17 with R16: every other card becomes the changed card's model, keeping its resolution and quality where that card's layout allows them.
  const spread = (next: GenerationPlan, from: CardRef, settings: SheetSettings): GenerationPlan => {
    const model = findCatalogModel(displayCatalog, settings.provider, settings.modelId);
    if (model === null) return next;
    return syncSettings(next, from, (_previous, mapCount) => retargetCardSettings(settings, model, maxTextureSize, mapCount));
  };
  // Every edit reads the plan it is applied to, so two edits before a re-render both land.
  const changeCard = (card: CardRef, settings: SheetSettings): void => {
    setPlan((current) => {
      const edited = card === 'decomposition' ? setDecompositionSettings(current, settings) : setImageSettings(current, card, settings);
      return sync ? spread(edited, card, settings) : edited;
    });
  };
  const setSync = (on: boolean): void => {
    setSyncOn(on);
    if (!on) return;
    setPlan((current) => {
      const lead = current.images[0]?.settings;
      return lead === undefined ? current : spread(current, 0, lead);
    });
  };
  const setIncluded = (included: boolean): void => {
    setPlan((current) => {
      const lead = current.images[0]?.settings;
      const model = lead === undefined ? null : findCatalogModel(displayCatalog, lead.provider, lead.modelId);
      return model === null ? current : setDecompositionIncluded(current, included, buildCardSettings(model, maxTextureSize, 1));
    });
  };

  return {
    plan,
    report,
    sync,
    setSync,
    assign: (map, image) => setPlan((current) => assignMap(current, map, image)),
    unassign: (map) => setPlan((current) => unassignMap(current, map)),
    addCard: () => setPlan((current) => {
      const lead = current.images[0]?.settings;
      return lead === undefined ? current : addImage(current, lead);
    }),
    removeCard: (image) => setPlan((current) => removeImage(current, image)),
    changeCard,
    setIncluded,
    load: setPlan,
  };
}
