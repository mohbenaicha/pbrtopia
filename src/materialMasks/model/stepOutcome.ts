/** The answer of one masks step that can fail for a reason the panel shows (masks R67). */
export type StepOutcome<T> = { ok: true; value: T } | { ok: false; message: string };
