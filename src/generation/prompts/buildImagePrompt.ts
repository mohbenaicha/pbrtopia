import { IMAGE_CLOSING, IMAGE_OPENING, describeReferences } from './framePrompt';
import type { MapRecipe } from './mapRecipes';
import { describeViewMarks } from './viewMarksWording';

interface ImagePromptParts {
  recipe: MapRecipe;
  description: string; // the enhancer's description of the model (spec C)
  referenceCount: number;
}

// R34: the prompt the image model gets: opening, view marks note (snapshot-orientation R7), references note, recipe text before, description, recipe text after, closing; each trimmed, empty ones left out.
export function buildImagePrompt({ recipe, description, referenceCount }: ImagePromptParts): string {
  return [IMAGE_OPENING, describeViewMarks(), describeReferences(referenceCount),recipe.textBefore, description, recipe.textAfter, IMAGE_CLOSING]
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .join('\n\n');
}
