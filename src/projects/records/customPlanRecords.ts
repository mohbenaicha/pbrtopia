import { FieldProblem, readChoice, readCount, readList, readNonEmptyText, readObject, readText, type RawRecord } from './fieldReaders';

// Custom generation R28 (data model): the plan a project keeps with its Generate settings. Same shapes as `generation/custom/planTypes`;
// repeated here because the project store does not import generation (A3, A5).
export interface SheetSettingsRecord {
  provider: 'gemini' | 'openai';
  modelId: string; // a model the catalog may no longer list: kept, the panel marks it unavailable (R28)
  resolutionKey: '1K' | '2K' | '2.8K' | '4K';
  quality: string | null;
}

export interface CustomPlanSheetRecord {
  cameras: number[]; // core indices 0-5, each at most once in the whole plan
  settings: SheetSettingsRecord;
}

export interface CustomPlanStoredRecord {
  sheets: CustomPlanSheetRecord[]; // 0 to 6, the first is the lead
  aux: { settings: SheetSettingsRecord } | null;
}

export interface NamedPlanStoredRecord {
  name: string;
  plan: CustomPlanStoredRecord;
}

const MAX_SHEETS = 6;
const CORE_CAMERA_COUNT = 6;

function readSheetSettings(value: unknown, path: string): SheetSettingsRecord {
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

export function readCustomPlan(value: unknown, path: string): CustomPlanStoredRecord {
  const raw: RawRecord = readObject(value, path);
  const used = new Set<number>();
  const sheets = readList(raw['sheets'], `${path}.sheets`, (item, itemPath) => {
    const sheet = readObject(item, itemPath);
    const cameras = readList(sheet['cameras'], `${itemPath}.cameras`, (camera, cameraPath) => {
      const index = readCount(camera, cameraPath);
      if (index >= CORE_CAMERA_COUNT || used.has(index)) throw new FieldProblem(cameraPath);
      used.add(index);
      return index;
    });
    return { cameras, settings: readSheetSettings(sheet['settings'], `${itemPath}.settings`) };
  });
  if (sheets.length > MAX_SHEETS) throw new FieldProblem(`${path}.sheets`);
  const auxRaw = raw['aux'];
  if (auxRaw !== null && (auxRaw === undefined || typeof auxRaw !== 'object')) throw new FieldProblem(`${path}.aux`);
  const aux = auxRaw === null ? null : { settings: readSheetSettings(readObject(auxRaw, `${path}.aux`)['settings'], `${path}.aux.settings`) };
  return { sheets, aux };
}

// R6: the saved setups, oldest first; a name used twice keeps the later one (in the place of the first).
export function readCustomSetups(value: unknown, path: string): NamedPlanStoredRecord[] {
  const setups: NamedPlanStoredRecord[] = [];
  for (const setup of readList(value, path, (item, itemPath): NamedPlanStoredRecord => {
    const raw = readObject(item, itemPath);
    return { name: readNonEmptyText(raw['name'], `${itemPath}.name`), plan: readCustomPlan(raw['plan'], `${itemPath}.plan`) };
  })) {
    const same = setups.findIndex((kept) => kept.name === setup.name);
    if (same >= 0) setups[same] = setup;
    else setups.push(setup);
  }
  return setups;
}
