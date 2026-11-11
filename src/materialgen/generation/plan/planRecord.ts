import { FieldProblem, readChoice, readList, readObject, readText, type RawRecord } from '@shared/projects';
import { MAX_MAP_IMAGES, PLAN_MAPS, type GenerationPlan, type SavedSetup, type SheetSettings } from './planTypes';

// Generation R70: the plan and the saved setups as the material record keeps them (`customPlan`, `savedSetups`). The reader is strict about the shape and keeps a model id
// the catalog may no longer list (R19); a record that does not read is dropped by the caller, never half used.

function readSettings(value: unknown, path: string): SheetSettings {
  const raw = readObject(value, path);
  const quality = raw['quality'];
  if (quality !== null && typeof quality !== 'string') throw new FieldProblem(`${path}.quality`);
  return {
    provider: readChoice(raw['provider'], `${path}.provider`, ['gemini', 'openai'] as const),
    modelId: readText(raw['modelId'], `${path}.modelId`),
    resolutionKey: readChoice(raw['resolutionKey'], `${path}.resolutionKey`, ['1K', '2K', '2.8K', '4K'] as const),
    quality,
  };
}

function readPlan(value: unknown, path: string): GenerationPlan {
  const raw = readObject(value, path);
  const seen = new Set<string>();
  const images = readList(raw['images'], `${path}.images`, (item, itemPath) => {
    const image = readObject(item, itemPath);
    const maps = readList(image['maps'], `${itemPath}.maps`, (map, mapPath) => {
      const name = readChoice(map, mapPath, PLAN_MAPS);
      if (seen.has(name)) throw new FieldProblem(mapPath);
      seen.add(name);
      return name;
    });
    return { maps: PLAN_MAPS.filter((name) => maps.includes(name)), settings: readSettings(image['settings'], `${itemPath}.settings`) };
  });
  if (images.length < 1 || images.length > MAX_MAP_IMAGES || !images[0]!.maps.includes('albedo')) throw new FieldProblem(`${path}.images`);
  const decomposition = raw['decomposition'] === null ? null : readSettings(raw['decomposition'], `${path}.decomposition`);
  return { images, decomposition };
}

const writeSettings = (settings: SheetSettings): RawRecord => ({ provider: settings.provider, modelId: settings.modelId, resolutionKey: settings.resolutionKey, quality: settings.quality });

export function writePlan(plan: GenerationPlan): RawRecord {
  return {
    images: plan.images.map((image) => ({ maps: [...image.maps], settings: writeSettings(image.settings) })),
    decomposition: plan.decomposition === null ? null : writeSettings(plan.decomposition),
  };
}

/** The saved active plan, or null when the project has none or it does not read (the caller starts on preset 1). */
export function parseStoredPlan(raw: RawRecord | undefined): GenerationPlan | null {
  if (raw === undefined) return null;
  try {
    return readPlan(raw, 'customPlan');
  } catch {
    return null;
  }
}

/** R20: the saved setups that read; a setup that does not, and a repeated name, are left out. */
export function parseSavedSetups(raws: readonly RawRecord[]): SavedSetup[] {
  const setups: SavedSetup[] = [];
  for (const raw of raws) {
    try {
      const name = readText(raw['name'], 'name').trim();
      if (name === '' || setups.some((setup) => setup.name === name)) continue;
      setups.push({ name, plan: readPlan(raw['plan'], 'plan') });
    } catch {
      continue;
    }
  }
  return setups;
}

export const writeSavedSetups = (setups: readonly SavedSetup[]): RawRecord[] => setups.map((setup) => ({ name: setup.name, plan: writePlan(setup.plan) }));
