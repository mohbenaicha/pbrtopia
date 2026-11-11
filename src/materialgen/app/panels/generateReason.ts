export const READ_ONLY_REASON = 'Open in another tab';

export interface GenerateGateInput {
  canWrite: boolean;
  prompt: string;
  referenceCount: number;
  keysReady: boolean; // the stored keys have been read, so a missing key is real
  planProblem: string | null; // the first problem of the plan (generation R9, R18, R25, R65-R67)
}

/**
 * Materialgen app R18, generation R9: why Generate cannot run now, or null when it can. Read-only first, then the prompt-or-reference rule (a non-space character or a
 * reference image is enough), then the plan's own problem (keys, models, layouts). A run going is not a reason here: the button then reads Cancel.
 */
export function describeGenerateBlock({ canWrite, prompt, referenceCount, keysReady, planProblem }: GenerateGateInput): string | null {
  if (!canWrite) return READ_ONLY_REASON;
  if (prompt.trim() === '' && referenceCount === 0) return 'Enter a prompt or add a reference image.';
  if (!keysReady) return 'Reading your keys.';
  return planProblem;
}
