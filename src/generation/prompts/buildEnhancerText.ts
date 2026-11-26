import { ENHANCER_INSTRUCTION } from './framePrompt';
import type { MapRecipe } from './mapRecipes';
import { IGNORE_VIEW_MARKS } from './viewMarksWording';

// Custom R15: the extra instruction of the overview in Custom, whose answer is shared by sheets that show other sides than the overview does.
const WHOLE_OBJECT_INSTRUCTION =
  'Describe the whole object, not only the side that is visible in these views, so the description also suits views from the back, the top and below.';

export type EnhancerScope = 'atlas' | 'object';

// R33: the text part of an enhancer request: the shared instruction and the recipe's focus, then the user's prompt under its label.
// The 'object' scope (custom R15) adds the whole-object instruction after the shared one.
export function buildEnhancerText(recipe: MapRecipe, userPrompt: string, scope: EnhancerScope = 'atlas'): string {
  const shared = `${ENHANCER_INSTRUCTION} ${IGNORE_VIEW_MARKS}`; // snapshot-orientation R8
  const instruction = scope === 'object' ? `${shared} ${WHOLE_OBJECT_INSTRUCTION}` : shared;
  const head = `${instruction}\n\n${recipe.enhancerFocus}`;
  const prompt = userPrompt.trim();
  return prompt === '' ? head : `${head}\n\nUser prompt:\n${prompt}`;
}
