import { parseBaseMaterials, type BaseMaterialTable } from './baseMaterials';

type DataFiles = Record<string, () => Promise<unknown>>;

/** Masks R34: the shipped table. A glob, so a build without the data file still works and the panel says the list is missing. */
const SHIPPED: DataFiles = import.meta.glob('../data/base-materials.json', { import: 'default' });

/** Masks R34: the one data file, parsed; fails when it is missing or not valid. */
export async function loadBaseMaterialsFrom(files: DataFiles): Promise<BaseMaterialTable> {
  const load = Object.values(files)[0];
  if (load === undefined) throw new Error('The base-material file is not part of this build.');
  return parseBaseMaterials(await load());
}

export const loadBaseMaterials = (): Promise<BaseMaterialTable> => loadBaseMaterialsFrom(SHIPPED);
