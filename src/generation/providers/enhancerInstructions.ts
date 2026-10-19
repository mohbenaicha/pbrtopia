// R8: the instruction sent with the atlas image to the prompt enhancer (the text the user supplied on 2026-10-17).
export const ENHANCER_INSTRUCTION =
  'Enhance this user prompt by describing what you see in the 3D image snapshots provided. Mention features and where they lie relative to the overall model (e.g. left, right, top). Describe each feature briefly without over-interpreting or over-complicating. Mention multiple instances when there are several (e.g. left hand, right hand, chest pocket, pant pocket, left window, back window). Keep the overall description to 100 words or less.';

// R8: the text part of an enhancer request: the instruction, then the user's prompt on a new paragraph.
export function buildEnhancerText(userPrompt: string): string {
  const prompt = userPrompt.trim();
  return prompt === '' ? ENHANCER_INSTRUCTION : `${ENHANCER_INSTRUCTION}\n\n${prompt}`;
}
