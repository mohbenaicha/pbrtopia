import { buildDecompositionText, type Component, type ComponentLimits } from '../../materialMasks';
import { IMAGE_CLOSING } from '../prompts/framePrompt';

/** mask-generation R7: a mask run asks the describe model for 2 to 10 components. */
export const MASK_COMPONENT_LIMITS: ComponentLimits = { min: 2, max: 10 };

/** mask-generation R7: the fixed instruction of the describe call (contracts.md, byte for byte). */
export const MASK_DESCRIBE_INSTRUCTION = [
  'You describe the materials of a 3D object shown in the attached image.',
  'The image holds six views of one single object on one sheet: front, right, back, left, top and bottom, each named in the band above it.',
  'Reply with JSON only: an array of 2 to 10 components, one for each visibly different material of the whole object. Count each material once, however many views show it.',
  'Each component is an object with three text fields:',
  '"name": a short name of the material,',
  '"description": what it looks like (material, colour, wear),',
  '"location": where it lies on the object, said for every view where it appears, for example "front: chest and sleeves; back: shoulder blades; top: none".',
  'Return no other field and no text outside the JSON.',
].join('\n');

/** The first sentences of the decomposition text (mask-generation R9); the colour lines and the closing sentence follow. */
export const MASK_DECOMPOSITION_FRAMING =
  'Repaint every perspective in this image as a flat colour map: one flat colour per material, using only these colours, with no gradients, no outlines, no shading and no text. Keep the exact silhouette, position and size of every perspective, and keep the grey background exactly as it is.';

/** A row of the project's masks record, as the describe text lists it (mask-generation R24). */
export interface ExistingMaterial {
  id: string; // the row's component id (mask-mode R27)
  name: string;
  description: string;
  material: string; // the row's base material (`defaultMaterial`)
}

const EXISTING_HEADING = 'Materials already described on this object:';
const EXISTING_RULES =
  'Some of these may be on parts that are hidden and not shown in the image. If a part you can see is made of one of these materials, return it with exactly that name. Add new components only for parts not covered. Do not return listed materials you cannot see.';

function buildExistingMaterialsBlock(existing: ReadonlyArray<ExistingMaterial>): string {
  const lines = existing.map((row) => `- "${row.name}"${row.description === '' ? '' : ` (${row.description})`}, material ${row.material}`);
  return [EXISTING_HEADING, ...lines, EXISTING_RULES].join('\n');
}

/** mask-generation R7, R24: the instruction, the existing-materials block when the project has masks, then the user's prompt after a blank line when there is one. */
export function buildMaskDescribeText(userPrompt: string, existing: ReadonlyArray<ExistingMaterial> = []): string {
  const prompt = userPrompt.trim();
  const parts = [MASK_DESCRIBE_INSTRUCTION];
  if (existing.length > 0) parts.push(buildExistingMaterialsBlock(existing));
  if (prompt !== '') parts.push(prompt);
  return parts.join('\n\n');
}

/** mask-generation R9: the mask core's decomposition under the projection framing (component k is painted with palette entry k), then the shape-keeping sentence. No user text. */
export function buildMaskDecomposition(components: ReadonlyArray<Component>): string {
  return `${buildDecompositionText(components, MASK_DECOMPOSITION_FRAMING)}\n\n${IMAGE_CLOSING}`;
}
