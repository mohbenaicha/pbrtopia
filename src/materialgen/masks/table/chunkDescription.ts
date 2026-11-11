const CHUNK_WORDS = 3;

/**
 * Masks R72: the pieces of a component's text that are embedded, as Materialize cuts them: lower-case, only letters, digits, spaces and hyphens,
 * then one chunk when there are 3 words or fewer, else every window of 3 consecutive words followed by the whole phrase.
 */
export function chunkDescription(text: string): string[] {
  const words = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/).filter((word) => word !== '');
  if (words.length === 0) return [];
  if (words.length <= CHUNK_WORDS) return [words.join(' ')];
  const windows = Array.from({ length: words.length - CHUNK_WORDS + 1 }, (_, start) => words.slice(start, start + CHUNK_WORDS).join(' '));
  return [...windows, words.join(' ')];
}
