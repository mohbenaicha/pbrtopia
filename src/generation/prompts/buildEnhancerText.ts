import { ENHANCER_INSTRUCTION } from './framePrompt';
import type { MapRecipe } from './mapRecipes';

// R33: the text part of an enhancer request: the shared instruction and the recipe's focus, then the user's prompt under its label.
export function buildEnhancerText(recipe: MapRecipe, userPrompt: string): string {
  const head = `${ENHANCER_INSTRUCTION}\n\n${recipe.enhancerFocus}`;
  const prompt = userPrompt.trim();
  return prompt === '' ? head : `${head}\n\nUser prompt:\n${prompt}`;
}
