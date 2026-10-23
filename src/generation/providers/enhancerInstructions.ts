// R8: the instruction sent with the atlas image to the prompt enhancer (the user's text of 2026-10-17, reworded 2026-10-23 so the enhancer
// describes one object, not the sheet, and counts each feature once).
export const ENHANCER_INSTRUCTION =
  'Enhance this user prompt by describing what you see in the 3D image snapshots provided. The snapshots are several views of one single object, laid out on one sheet: describe that one object, never the sheet or its views, and count each feature once however many views show it (an object with one staff has one staff). Mention features and where they lie relative to the overall model (e.g. left, right, top, front, back). Describe each feature briefly without over-interpreting or over-complicating. Mention multiple instances only when the object itself has several (e.g. left hand and right hand, two windows). Keep the overall description to 100 words or less.';

// R8: the text part of an enhancer request: the instruction, then the user's prompt on a new paragraph.
export function buildEnhancerText(userPrompt: string): string {
  const prompt = userPrompt.trim();
  return prompt === '' ? ENHANCER_INSTRUCTION : `${ENHANCER_INSTRUCTION}\n\n${prompt}`;
}
