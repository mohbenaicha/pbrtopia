import { makeProviderError } from '../classifyProviderError';
import type { ProviderError, Result } from '../providerTypes';

const asRecord = (value: unknown): Record<string, unknown> | null => (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null);

// R46: the image of an images answer: data[0].b64_json with its media_type (png when absent), and usage.cost in USD when it is a number.
// No image is a server error (retryable).
export function parseOpenRouterImage(body: unknown): Result<{ base64: string; mimeType: string; costUsd?: number }, ProviderError> {
  const record = asRecord(body);
  const first = Array.isArray(record?.data) ? asRecord(record.data[0]) : null;
  const base64 = first?.b64_json;
  if (typeof base64 !== 'string' || base64.length === 0) return { ok: false, error: makeProviderError('server') };
  const mimeType = typeof first?.media_type === 'string' && first.media_type.startsWith('image/') ? first.media_type : 'image/png';
  const cost = asRecord(record?.usage)?.cost;
  return { ok: true, value: { base64, mimeType, ...(typeof cost === 'number' && Number.isFinite(cost) ? { costUsd: cost } : {}) } };
}
