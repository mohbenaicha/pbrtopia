import { GENERIC, type BaseMaterialTable } from './baseMaterials';
import { chunkDescription } from './chunkDescription';

/** Turns texts into vectors of the shipped model; it may be slow to load (masks R73) and may fail. */
export interface Embedder {
  embed(texts: string[]): Promise<Float32Array[]>;
}

export type MatchKind = 'embedding' | 'keyword';

export interface MaterialMatch {
  material: string; // the default base material of the row
  top3: string[]; // offered first in the row's select
  kind: MatchKind;
}

/** Masks R76: how long the embedder may take before the keyword match is used instead (a proposal). */
export const EMBEDDER_TIMEOUT_MS = 20_000;

const words = (text: string): string[] => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/**
 * Masks R77: each material scores the number of distinct lower-case words its name shares with the text; ties go to file order. A text that
 * shares no word gets Generic and no suggestions.
 */
export function keywordMatch(text: string, table: BaseMaterialTable): MaterialMatch {
  const wanted = new Set(words(text));
  const scored = table
    .map((entry, index) => ({ name: entry.name, index, score: [...new Set(words(entry.name))].filter((word) => wanted.has(word)).length }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const top3 = scored.slice(0, 3).map((entry) => entry.name);
  return { material: top3[0] ?? GENERIC.name, top3, kind: 'keyword' };
}

interface MatchRequest {
  texts: string[]; // "name + description" of each component
  table: BaseMaterialTable;
  vectors: readonly Float32Array[] | null; // one per table entry, in the same order; null when the file is missing
  embedder: Embedder;
  timeoutMs?: number;
}

const norm = (vector: Float32Array): number => Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

async function embedWithin(embedder: Embedder, chunks: string[], timeoutMs: number): Promise<Float32Array[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([embedder.embed(chunks).catch(() => null), late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Masks R72-R77: the base material of each text. Each text is cut into chunks (chunkDescription), all chunks are embedded in one call, and each
 * chunk is compared by cosine with every material vector. Each chunk's best three are pooled, a material keeping its best score, and the top
 * three by score (ties to the earlier file entry) are the row's suggestions, the first being its default. When the vectors are missing, the
 * embedder fails or is not ready in time, or a text scores nothing, the keyword match is used for it and no error shows.
 */
export async function matchBaseMaterials({ texts, table, vectors, embedder, timeoutMs = EMBEDDER_TIMEOUT_MS }: MatchRequest): Promise<MaterialMatch[]> {
  const keywords = (): MaterialMatch[] => texts.map((text) => keywordMatch(text, table));
  if (vectors === null || vectors.length !== table.length) return keywords();
  const owners: number[] = [];
  const chunks: string[] = [];
  texts.forEach((text, owner) => {
    for (const chunk of chunkDescription(text)) {
      owners.push(owner);
      chunks.push(chunk);
    }
  });
  if (chunks.length === 0) return keywords();
  const embedded = await embedWithin(embedder, chunks, timeoutMs);
  if (embedded === null || embedded.length !== chunks.length) return keywords();

  const norms = vectors.map(norm);
  const best = texts.map(() => new Map<number, number>()); // per text: material index -> best score
  embedded.forEach((query, chunk) => {
    const queryNorm = norm(query);
    if (queryNorm === 0) return;
    const scores = vectors.map((vector, index) => {
      let dot = 0;
      for (let at = 0; at < vector.length; at += 1) dot += vector[at]! * (query[at] ?? 0);
      return { index, score: norms[index] === 0 ? 0 : dot / (norms[index]! * queryNorm) };
    });
    scores.sort((a, b) => b.score - a.score || a.index - b.index);
    const pooled = best[owners[chunk]!]!;
    for (const { index, score } of scores.slice(0, 3)) pooled.set(index, Math.max(score, pooled.get(index) ?? -Infinity));
  });

  return texts.map((text, owner) => {
    const ranked = [...best[owner]!.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 3);
    if (ranked.length === 0 || ranked[0]![1] <= 0) return keywordMatch(text, table);
    const top3 = ranked.map(([index]) => table[index]!.name);
    return { material: top3[0]!, top3, kind: 'embedding' };
  });
}
