import { DEFAULT_COMPONENT_LIMITS, type ComponentLimits } from '../describe/parseComponents';

/** Masks R2, material-masks-core R6: the fixed instruction of the describe call under the given component limits; it asks for JSON only and nothing about base materials. */
function buildDescribeInstruction({ min, max }: ComponentLimits): string {
  return [
    'You describe the parts of a seamless material texture shown in the attached image.',
    `Reply with JSON only: an array of ${min} to ${max} components, one for each visibly different part of the surface.`,
    'Each component is an object with three text fields:',
    '"name": a short name of the part,',
    '"description": what the part looks like (material, colour, wear),',
    '"location": where the part lies in the image, in words.',
    'Return no other field and no text outside the JSON.',
  ].join('\n');
}

/** The instruction under material gen's limits (3 to 10). */
export const DESCRIBE_INSTRUCTION = buildDescribeInstruction(DEFAULT_COMPONENT_LIMITS);

/** Masks R1, R2: the instruction first, then the user's prompt when there is one. */
export function buildDescribeText(userText: string, limits: ComponentLimits = DEFAULT_COMPONENT_LIMITS, customInstruction?: string): string {
  const instruction = customInstruction ?? buildDescribeInstruction(limits); // material-masks-core R6: a caller (projection masks) may bring its own instruction
  const prompt = userText.trim();
  return prompt === '' ? instruction : `${instruction}\n\n${prompt}`;
}
