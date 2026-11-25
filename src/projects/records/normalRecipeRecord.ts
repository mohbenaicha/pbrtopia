import { clampReauthorParams } from '../../normalRecipe/clampReauthorParams';
import type { ReauthorParams } from '../../normalRecipe/reauthorParams';
import { FieldProblem, readBlobKey, readList, readNonEmptyText, readObject, readTimestamp } from './fieldReaders';
import type { PictureRecord } from './pictureRecords';

/** The recipe of one generated normal map: the base it is re-authored from and the settings that make the stored picture (normal-reauthor R19). */
export interface NormalRecipeRecord {
  pictureId: string; // a generated normal picture of the project; at most one recipe per picture
  baseBlobKey: string; // normals/<id>.png: the base the picture is re-authored from, upright, never rewritten
  baseKind: NormalBaseKind; // normal-height-edit R13: 'height' is a grey height picture, 'normal' a base normal (older pictures: three sliders only)
  params: ReauthorParams;
  createdAt: string; // ISO time
}

export type NormalBaseKind = 'height' | 'normal';

export const NORMALS_PREFIX = 'normals/';

export const normalBaseBlobKey = (baseId: string): string => `${NORMALS_PREFIX}${baseId}.png`;

function readBaseKind(value: unknown, path: string): NormalBaseKind {
  if (value === undefined || value === 'normal') return 'normal'; // R14: a missing kind is an older recipe
  if (value === 'height') return 'height';
  throw new FieldProblem(path);
}

function readNormalRecipe(value: unknown, path: string): NormalRecipeRecord {
  const raw = readObject(value, path);
  const baseBlobKey = readBlobKey(raw['baseBlobKey'], `${path}.baseBlobKey`);
  if (!baseBlobKey.startsWith(NORMALS_PREFIX)) throw new FieldProblem(`${path}.baseBlobKey`);
  const baseKind = readBaseKind(raw['baseKind'], `${path}.baseKind`);
  const params = clampReauthorParams(readObject(raw['params'], `${path}.params`));
  return {
    pictureId: readNonEmptyText(raw['pictureId'], `${path}.pictureId`),
    baseBlobKey,
    baseKind,
    params: baseKind === 'normal' ? { ...params, sharpness: 0 } : params, // R13: a recipe without a height has no Sharpness

    createdAt: readTimestamp(raw['createdAt'], `${path}.createdAt`),
  };
}

/**
 * Strict about the list, forgiving about the params: a missing list is no recipes; a recipe for a picture that does not exist, is not a generated normal map or is listed twice, a key outside `normals/`, or a bad field is a FieldProblem. Params are clamped to their ranges (R4).
 */
export function readNormalRecipes(value: unknown, path: string, pictures: readonly PictureRecord[]): NormalRecipeRecord[] {
  if (value === undefined) return [];
  const recipes = readList(value, path, readNormalRecipe);
  const generatedNormals = new Set(pictures.filter((picture) => picture.channel === 'normal' && picture.origin.kind === 'generate').map((picture) => picture.id));
  const seen = new Set<string>();
  recipes.forEach((recipe, index) => {
    if (!generatedNormals.has(recipe.pictureId) || seen.has(recipe.pictureId)) throw new FieldProblem(`${path}[${index}].pictureId`);
    seen.add(recipe.pictureId);
  });
  return recipes;
}
