/** Generation R72: the fixed instruction of the prompt-ideas call; it asks for three ideas as JSON only. */
export const IDEAS_INSTRUCTION = [
  'Give exactly 3 different prompt ideas for a seamless, tileable, top-down texture of the material described below.',
  'Each idea keeps the intent of the description and adds concrete detail (surface, colour, wear, scale) in one prompt of 10 to 50 words.',
  'Reply with a JSON array of 3 strings and no other text.',
].join('\n');

/** Generation R72: the instruction, then the user's text verbatim. */
export function buildIdeasText(userText: string): string {
  return `${IDEAS_INSTRUCTION}\n\n${userText}`;
}
