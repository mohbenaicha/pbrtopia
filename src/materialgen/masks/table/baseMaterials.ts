export interface BaseMaterial {
  name: string;
  roughness: number; // 0 to 1
  metal: number; // 0 to 1
  rgb: readonly [number, number, number];
}

export type BaseMaterialTable = readonly BaseMaterial[]; // in file order

/** Masks R13: the built-in material for a region nothing matched. It is not part of the file. */
export const GENERIC: BaseMaterial = { name: 'Generic', roughness: 0.5, metal: 0, rgb: [128, 128, 128] };

const isUnit = (value: unknown): value is number => typeof value === 'number' && value >= 0 && value <= 1;
const isByte = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;

/**
 * Masks R34: reads `{ "<name>": [roughness, metalness, [r, g, b]] }`, keeping the file's order. A name that is empty, a value outside 0 to 1 and a
 * colour that is not three whole numbers of 0 to 255 are refused. (The count of 1000 is checked on the shipped file, not here.)
 */
export function parseBaseMaterials(file: unknown): BaseMaterialTable {
  if (file === null || typeof file !== 'object' || Array.isArray(file)) throw new Error('The base-material file must be an object of names.');
  const entries = Object.entries(file as Record<string, unknown>);
  if (entries.length === 0) throw new Error('The base-material file is empty.');
  return entries.map(([name, value]) => {
    if (name.trim() === '') throw new Error('A base material has an empty name.');
    if (!Array.isArray(value) || value.length < 3) throw new Error(`${name}: expected [roughness, metalness, [r, g, b]].`);
    const [roughness, metal, rgb] = value as unknown[];
    if (!isUnit(roughness) || !isUnit(metal)) throw new Error(`${name}: roughness and metalness are numbers from 0 to 1.`);
    if (!Array.isArray(rgb) || rgb.length !== 3 || !rgb.every(isByte)) throw new Error(`${name}: the colour is three whole numbers from 0 to 255.`);
    const [r, g, b] = rgb as [number, number, number];
    return { name, roughness, metal, rgb: [r, g, b] as const };
  });
}

/** Masks R39: a material by name, or undefined; "Generic" is always known. */
export function findMaterial(table: BaseMaterialTable, name: string): BaseMaterial | undefined {
  return name === GENERIC.name ? GENERIC : table.find((entry) => entry.name === name);
}

export interface MaterialOption extends BaseMaterial {
  suggested: boolean;
}

/**
 * Masks R37: what a row's select lists: the suggested materials first (Suggested), then Generic, then every name alphabetically; typing keeps
 * the names that hold the text, whatever the case.
 */
export function listMaterialOptions(table: BaseMaterialTable, top3: readonly string[], filter: string): MaterialOption[] {
  const suggested = top3.flatMap((name) => {
    const found = table.find((entry) => entry.name === name);
    return found === undefined ? [] : [{ ...found, suggested: true }];
  });
  const alphabetical = [...table].sort((a, b) => a.name.localeCompare(b.name)).map((entry) => ({ ...entry, suggested: false }));
  const needle = filter.trim().toLowerCase();
  return [...suggested, { ...GENERIC, suggested: false }, ...alphabetical].filter((option) => needle === '' || option.name.toLowerCase().includes(needle));
}
