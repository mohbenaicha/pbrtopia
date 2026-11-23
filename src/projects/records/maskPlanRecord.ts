import { MAX_COMPONENTS, paletteFor, type MaterialMatch, type PaletteEntry } from '../../materialMasks';
import { FieldProblem, readChoice, readList, readNonEmptyText, readObject, readText } from './fieldReaders';

export const MAX_COMPONENT_ID_LENGTH = 64;

/** Mask-generation data model: one part of the model the describe step named. */
export interface MaskComponent {
  id: string; // stable name of the component (mask-mode R27), 1 to 64 characters, unique within the plan
  name: string;
  description: string;
  location: string;
}

/** The mask core's match of a component to a base material (a type of the core, not redefined here). */
export type MaskMatch = MaterialMatch;

/** What a mask set keeps of its describe step: the components, their palette colours and, once matched, the materials. */
export interface MaskPlan {
  albedoPictureId: string | null; // the source albedo: the stale notice and the colour mixin use it; null when it was the model's own albedo (textures R24)
  describeModelId: string; // history only
  userPrompt: string; // '' when none
  components: MaskComponent[]; // 2..10
  palette: PaletteEntry[]; // entry k belongs to component k (label k)
  matches?: MaskMatch[]; // same length as components when present
  replaceCurrent?: boolean; // mask-mode R25: Bake masks replaces the project's masks record instead of merging; absent reads as false
}

export const MIN_MASK_COMPONENTS = 2;
const MAX_TEXT = 2000;
const MATCH_KINDS = ['embedding', 'keyword'] as const;

// Trimmed, and at most 2000 characters after trimming; a longer one is a corrupt set, never a silent cut.
function readPlanText(value: unknown, path: string): string {
  const text = readText(value, path).trim();
  if (text.length > MAX_TEXT) throw new FieldProblem(path);
  return text;
}

export function readComponentId(value: unknown, path: string): string {
  const id = readNonEmptyText(value, path);
  if (id.length > MAX_COMPONENT_ID_LENGTH) throw new FieldProblem(path);
  return id;
}

function readComponent(value: unknown, path: string, setId: string, index: number): MaskComponent {
  const raw = readObject(value, path);
  const id = raw['id'] === undefined ? `${setId}#${index}` : readComponentId(raw['id'], `${path}.id`);
  return { id, name: readPlanText(raw['name'], `${path}.name`), description: readPlanText(raw['description'], `${path}.description`), location: readPlanText(raw['location'], `${path}.location`) };
}

function readMatch(value: unknown, path: string): MaskMatch {
  const raw = readObject(value, path);
  return { material: readPlanText(raw['material'], `${path}.material`), top3: readList(raw['top3'], `${path}.top3`, (item, itemPath) => readPlanText(item, itemPath)), kind: readChoice(raw['kind'], `${path}.kind`, MATCH_KINDS) };
}

function readPaletteEntry(value: unknown, path: string): PaletteEntry {
  const raw = readObject(value, path);
  return { label: readChoice(raw['label'], `${path}.label`, Array.from({ length: MAX_COMPONENTS }, (_, k) => k)), hex: readText(raw['hex'], `${path}.hex`), name: readText(raw['name'], `${path}.name`) };
}

/** Strict: a bad field, a count outside 2..10, a palette that is not the shared palette's first N entries, or matches of another length make the set corrupt. */
export function readMaskPlan(value: unknown, path: string, setId: string): MaskPlan {
  const raw = readObject(value, path);
  let position = 0;
  const components = readList(raw['components'], `${path}.components`, (item, itemPath) => readComponent(item, itemPath, setId, position++));
  if (new Set(components.map((component) => component.id)).size !== components.length) throw new FieldProblem(`${path}.components`); // mask-mode R27
  if (components.length < MIN_MASK_COMPONENTS || components.length > MAX_COMPONENTS) throw new FieldProblem(`${path}.components`);
  const palette = readList(raw['palette'], `${path}.palette`, readPaletteEntry);
  const shared = paletteFor(components.length);
  const agrees = palette.length === shared.length && palette.every((entry, k) => entry.label === k && entry.hex === shared[k]?.hex && entry.name === shared[k]?.name);
  if (!agrees) throw new FieldProblem(`${path}.palette`);
  const plan: MaskPlan = {
    albedoPictureId: raw['albedoPictureId'] === null ? null : readNonEmptyText(raw['albedoPictureId'], `${path}.albedoPictureId`),
    describeModelId: readText(raw['describeModelId'], `${path}.describeModelId`),
    userPrompt: readPlanText(raw['userPrompt'], `${path}.userPrompt`),
    components,
    palette,
  };
  if (raw['replaceCurrent'] !== undefined) {
    if (typeof raw['replaceCurrent'] !== 'boolean') throw new FieldProblem(`${path}.replaceCurrent`);
    plan.replaceCurrent = raw['replaceCurrent'];
  }
  if (raw['matches'] !== undefined) {
    const matches = readList(raw['matches'], `${path}.matches`, readMatch);
    if (matches.length !== components.length) throw new FieldProblem(`${path}.matches`);
    plan.matches = matches;
  }
  return plan;
}
