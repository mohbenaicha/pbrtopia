import { describe, expect, it } from 'vitest';
import {
  buildGeminiEnhanceBody,
  buildGeminiImageBody,
  checkInlineSize,
  GEMINI_INTERACTIONS_URL,
  INLINE_LIMIT_BYTES,
} from '../../../../src/generation/providers/gemini/geminiRequests';

const atlas = { mimeType: 'image/png', base64: 'ATLAS' };
const ref = { mimeType: 'image/jpeg', base64: 'REF1' };
const base = { model: 'gemini-3.1-flash-image', prompt: 'weathered steel', resolutionKey: '2K' as const, quality: 'high' as string | null, images: [atlas, ref] };

describe('buildGeminiImageBody (R7)', () => {
  it('R7 puts the prompt first, then the atlas, then the references', () => {
    const result = buildGeminiImageBody(base);
    expect(result.ok && result.value.input).toEqual([
      { type: 'text', text: 'weathered steel' },
      { type: 'image', mime_type: 'image/png', data: 'ATLAS' },
      { type: 'image', mime_type: 'image/jpeg', data: 'REF1' },
    ]);
  });

  it('R7 asks for a JPEG, a square and the chosen size', () => {
    const result = buildGeminiImageBody(base);
    expect(result.ok && result.value.response_format).toEqual({ type: 'image', mime_type: 'image/jpeg', aspect_ratio: '1:1', image_size: '2K' });
    expect(result.ok && result.value.model).toBe('gemini-3.1-flash-image');
  });

  it('custom R12 a canvas sets the aspect ratio of the answer to the documented ratio it has', () => {
    const ratioOf = (width: number, height: number) => {
      const result = buildGeminiImageBody({ ...base, canvas: { width, height } });
      return result.ok ? result.value.response_format.aspect_ratio : result.error.category;
    };
    expect(ratioOf(2048, 1365)).toBe('3:2');
    expect(ratioOf(1365, 2048)).toBe('2:3');
    expect(ratioOf(2048, 2048)).toBe('1:1');
    expect(ratioOf(2048, 878)).toBe('21:9');
    expect(ratioOf(1152, 2048)).toBe('9:16');
  });

  it('custom R12 a canvas whose shape Gemini has no ratio for is refused before anything is sent', () => {
    expect(buildGeminiImageBody({ ...base, canvas: { width: 1024, height: 2048 } })).toMatchObject({ ok: false, error: { category: 'bad-request', retryable: false } });
  });

  it('custom R12 without a canvas the answer stays square', () => {
    const result = buildGeminiImageBody(base);
    expect(result.ok && result.value.response_format.aspect_ratio).toBe('1:1');
  });

  it('R5 sends the chosen quality level unchanged as thinking_level', () => {
    for (const level of ['minimal', 'medium', 'high']) {
      const result = buildGeminiImageBody({ ...base, quality: level });
      expect(result.ok && result.value.generation_config).toEqual({ thinking_level: level });
    }
  });

  it('R5 leaves generation_config out when the model has no levels', () => {
    const result = buildGeminiImageBody({ ...base, quality: null });
    expect(result.ok && 'generation_config' in result.value).toBe(false);
  });

  it('R4 accepts 1K, 2K and 4K', () => {
    for (const key of ['1K', '2K', '4K'] as const) {
      const result = buildGeminiImageBody({ ...base, resolutionKey: key });
      expect(result.ok && result.value.response_format.image_size).toBe(key);
    }
  });

  it('R4 refuses a size Gemini has no name for, before anything is sent', () => {
    const result = buildGeminiImageBody({ ...base, resolutionKey: '2.8K' });
    expect(result).toMatchObject({ ok: false, error: { category: 'bad-request', retryable: false } });
  });

  it('R7 an atlas alone is allowed (no references)', () => {
    const result = buildGeminiImageBody({ ...base, images: [atlas] });
    expect(result.ok && result.value.input).toHaveLength(2);
  });
});

describe('buildGeminiEnhanceBody (R8)', () => {
  it('R33 carries the built enhancer text exactly as given, then the atlas, and no response_format', () => {
    const body = buildGeminiEnhanceBody({ model: 'gemini-3.8-flash', prompt: 'built enhancer text', atlas, level: null });
    expect(body.model).toBe('gemini-3.8-flash');
    expect(body.input[0]).toEqual({ type: 'text', text: 'built enhancer text' });
    expect(body.input[1]).toEqual({ type: 'image', mime_type: 'image/png', data: 'ATLAS' });
    expect('response_format' in body).toBe(false);
  });

  it('R8 a level is sent as generation_config.thinking_level', () => {
    const body = buildGeminiEnhanceBody({ model: 'gemini-3.8-flash', prompt: 'weathered steel', atlas, level: 'low' });
    expect(body.generation_config).toEqual({ thinking_level: 'low' });
  });

  it('R8 no level sends no generation_config at all', () => {
    const body = buildGeminiEnhanceBody({ model: 'gemini-3.5-flash-lite', prompt: 'weathered steel', atlas, level: null });
    expect('generation_config' in body).toBe(false);
  });
});

describe('checkInlineSize (R7)', () => {
  const blobOf = (bytes: number): Blob => new Blob([new Uint8Array(bytes)]);

  it('R7 a request well under 20 MiB passes', () => {
    expect(checkInlineSize([blobOf(1_000_000), blobOf(2_000_000)], 'prompt')).toBeNull();
  });

  it('R7 counts base64, one third more than the bytes: 16 MiB of images is over the limit', () => {
    const error = checkInlineSize([blobOf(16 * 1024 * 1024)], 'prompt');
    expect(error).toMatchObject({ category: 'bad-request', retryable: false, message: 'The images are too big for this model: lower the resolution or remove references' });
  });

  it('R7 the limit is on the sum of all images', () => {
    const half = Math.floor((INLINE_LIMIT_BYTES * 3) / 4 / 2) + 1000;
    expect(checkInlineSize([blobOf(half), blobOf(half)], '')).not.toBeNull();
    expect(checkInlineSize([blobOf(half)], '')).toBeNull();
  });
});

describe('endpoint (R13, R14)', () => {
  it('R13 posts to the Interactions endpoint of the v1beta API', () => {
    expect(GEMINI_INTERACTIONS_URL).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
  });
});
