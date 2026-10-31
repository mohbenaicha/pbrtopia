// R8, R30: the shared instruction sent with the atlas image to the prompt enhancer, for every map (the user's text of 2026-10-17, reworded 2026-10-23 so the enhancer
// describes one object, not the sheet, and counts each feature once).
export const ENHANCER_INSTRUCTION =
  'Enhance this user prompt by describing what you see in the 3D image snapshots provided. The snapshots are several views of one single object, laid out on one sheet: describe that one object, never the sheet or its views, and count each feature once however many views show it (an object with one staff has one staff). Mention features and where they lie relative to the overall model (e.g. left, right, top, front, back). Describe each feature briefly without over-interpreting or over-complicating. Mention multiple instances only when the object itself has several (e.g. left hand and right hand, two windows). Keep the overall description to 100 words or less.';

// R31: the pieces of the image prompt that are the same for every map (the user's texts of 2026-10-31).
export const IMAGE_OPENING =
  'Texture image 1 (the first image provided) in place, meaning all the 3D model perspectives in it are textured in place, accurately following the geometry and staying consistent among the perspectives.';
export const IMAGE_CLOSING = 'Do not change the shape or position or contour of the model, maintain structural integrity and consistency across all perspectives strictly.';

// R31: tells the image model which images are references, by number (the atlas is always image 1); empty when there are none.
export function describeReferences(referenceCount: number): string {
  if (referenceCount <= 0) return '';
  if (referenceCount === 1) {
    return 'Image 2 is a reference only. Use it as a guide for how the surfaces should look. Do not texture it, and do not paste the reference picture or its layout into the result.';
  }
  return `Images 2 to ${referenceCount + 1} are references only. Use them as a guide for how the surfaces should look. Do not texture them, and do not paste the reference pictures or their layout into the result.`;
}
