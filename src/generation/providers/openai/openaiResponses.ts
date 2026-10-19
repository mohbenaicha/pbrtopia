import { makeProviderError } from '../classifyProviderError';
import type { ProviderError, Result } from '../providerTypes';

const asRecord = (value: unknown): Record<string, unknown> | null => (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null);

// R7: the image of an edits answer: data[0].b64_json, always a PNG (the request asks for one). Anything else is a server error (retryable).
export function parseOpenAiImage(body: unknown): Result<{ base64: string; mimeType: string }, ProviderError> {
  const data = asRecord(body)?.data;
  const first = Array.isArray(data) ? asRecord(data[0]) : null;
  const base64 = first?.b64_json;
  if (typeof base64 !== 'string' || base64.length === 0) return { ok: false, error: makeProviderError('server') };
  return { ok: true, value: { base64, mimeType: 'image/png' } };
}

// R8: the text of a Responses answer: the output_text parts of its message items, joined and trimmed. None is a server error (retryable).
// Not seen live: the answer path is the documented one.
export function parseOpenAiText(body: unknown): Result<string, ProviderError> {
  const output = asRecord(body)?.output;
  const messages = Array.isArray(output) ? output.map(asRecord).filter((item): item is Record<string, unknown> => item?.type === 'message') : [];
  const parts = messages.flatMap((message) => (Array.isArray(message.content) ? (message.content as unknown[]) : []));
  const text = parts
    .map(asRecord)
    .filter((part): part is Record<string, unknown> => part?.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('')
    .trim();
  return text.length > 0 ? { ok: true, value: text } : { ok: false, error: makeProviderError('server') };
}
