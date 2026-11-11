import { MAX_COMPONENTS, MIN_COMPONENTS } from '../describe/parseComponents';

/** Masks R2: the fixed instruction of the describe call; it asks for JSON only and nothing about base materials. */
export const DESCRIBE_INSTRUCTION = [
  'You describe the parts of a seamless material texture shown in the attached image.',
  `Reply with JSON only: an array of ${MIN_COMPONENTS} to ${MAX_COMPONENTS} components, one for each visibly different part of the surface.`,
  'Each component is an object with three text fields:',
  '"name": a short name of the part,',
  '"description": what the part looks like (material, colour, wear),',
  '"location": where the part lies in the image, in words.',
  'Return no other field and no text outside the JSON.',
].join('\n');

/** Masks R1, R2: the instruction first, then the user's prompt when there is one. */
export function buildDescribeText(userText: string): string {
  const prompt = userText.trim();
  return prompt === '' ? DESCRIBE_INSTRUCTION : `${DESCRIBE_INSTRUCTION}\n\n${prompt}`;
}
