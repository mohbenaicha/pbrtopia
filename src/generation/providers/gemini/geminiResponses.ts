import { detailsOf, makeProviderError } from '../classifyProviderError';
import type { ProviderError, Result } from '../providerTypes';

const asRecord = (value: unknown): Record<string, unknown> | null => (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null);

// The parts of every `model_output` step, in order. Thought steps are skipped.
function outputParts(body: unknown): Record<string, unknown>[] {
  const steps = asRecord(body)?.steps;
  if (!Array.isArray(steps)) return [];
  const contents: unknown[] = steps.flatMap((step: unknown) => {
    const record = asRecord(step);
    return record?.type === 'model_output' && Array.isArray(record.content) ? (record.content as unknown[]) : [];
  });
  return contents.map(asRecord).filter((part): part is Record<string, unknown> => part !== null);
}

const textOf = (parts: Record<string, unknown>[]): string =>
  parts.filter((part) => part.type === 'text' && typeof part.text === 'string').map((part) => part.text as string).join('');

// R7: the image of an answer. A text part with no image is the model refusing (seen once in the live check): moderation, with its words in details.
export function parseGeminiImage(body: unknown): Result<{ base64: string; mimeType: string }, ProviderError> {
  const parts = outputParts(body);
  const image = parts.find((part) => part.type === 'image' && typeof part.data === 'string' && part.data.length > 0);
  if (image !== undefined) return { ok: true, value: { base64: image.data as string, mimeType: typeof image.mime_type === 'string' ? image.mime_type : 'image/jpeg' } };
  const refusal = detailsOf(textOf(parts));
  return { ok: false, error: refusal === undefined ? makeProviderError('server') : makeProviderError('moderation', { details: refusal }) };
}

// R8: the text of an answer, trimmed. An answer with no text is a server error (retryable).
export function parseGeminiText(body: unknown): Result<string, ProviderError> {
  const text = textOf(outputParts(body)).trim();
  return text.length > 0 ? { ok: true, value: text } : { ok: false, error: makeProviderError('server') };
}
