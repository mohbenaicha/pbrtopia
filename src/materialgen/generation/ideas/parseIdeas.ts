export const IDEAS_UNREADABLE = 'The ideas could not be read. Try again.';

export const IDEA_COUNT = 3;

export type IdeasParse = { ok: true; ideas: string[] } | { ok: false; message: string };

const FENCE = /^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/;

/** Generation R72: reads the model's answer: a JSON array of strings (code-fenced or not) or an object with an `ideas` array; ideas trimmed, blanks, non-strings and exact duplicates dropped, the first three kept. */
export function parseIdeas(answer: string): IdeasParse {
  const trimmed = answer.trim();
  const body = FENCE.exec(trimmed)?.[1] ?? trimmed;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, message: IDEAS_UNREADABLE };
  }
  const list = Array.isArray(parsed) ? parsed : (parsed as { ideas?: unknown } | null)?.ideas;
  if (!Array.isArray(list)) return { ok: false, message: IDEAS_UNREADABLE };
  const usable = list.flatMap((entry: unknown) => (typeof entry === 'string' && entry.trim() !== '' ? [entry.trim()] : []));
  const ideas = [...new Set(usable)].slice(0, IDEA_COUNT); // exact duplicates would select two numbers at once (R73)
  return ideas.length === IDEA_COUNT ? { ok: true, ideas } : { ok: false, message: IDEAS_UNREADABLE };
}
