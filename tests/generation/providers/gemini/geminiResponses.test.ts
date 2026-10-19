import { describe, expect, it } from 'vitest';
import { parseGeminiImage, parseGeminiText } from '../../../../src/generation/providers/gemini/geminiResponses';

// Shapes recorded in the live check (research/api/live-check.md).
const answer = (content: unknown[]) => ({ id: 'v1_x', status: 'completed', steps: [{ type: 'thought', signature: 's' }, { type: 'model_output', content }], object: 'interaction' });
const imagePart = { type: 'image', mime_type: 'image/jpeg', data: 'SGk=' };

describe('parseGeminiImage (R7)', () => {
  it('R7 returns the base64 and the mime type of the image part', () => {
    expect(parseGeminiImage(answer([imagePart]))).toEqual({ ok: true, value: { base64: 'SGk=', mimeType: 'image/jpeg' } });
  });

  it('R7 skips thought steps and text parts to find the image', () => {
    const body = { steps: [{ type: 'thought' }, { type: 'model_output', content: [{ type: 'text', text: 'Here it is' }, imagePart] }] };
    expect(parseGeminiImage(body)).toMatchObject({ ok: true, value: { base64: 'SGk=' } });
  });

  it('R9 a text part and no image is a moderation error with the text in details', () => {
    const result = parseGeminiImage(answer([{ type: 'text', text: 'I cannot create that image.' }]));
    expect(result).toMatchObject({ ok: false, error: { category: 'moderation', retryable: false, details: 'I cannot create that image.' } });
  });

  it('R9 no image and no text is a retryable server error', () => {
    for (const body of [answer([]), { steps: [] }, {}, { steps: [{ type: 'thought' }] }]) {
      expect(parseGeminiImage(body)).toMatchObject({ ok: false, error: { category: 'server', retryable: true } });
    }
  });

  it('R9 an image part without data is not an image', () => {
    expect(parseGeminiImage(answer([{ type: 'image', mime_type: 'image/jpeg' }]))).toMatchObject({ ok: false, error: { category: 'server' } });
    expect(parseGeminiImage(answer([{ type: 'image', mime_type: 'image/jpeg', data: '' }]))).toMatchObject({ ok: false });
  });

  it('R9 a missing mime type defaults to JPEG, the only output format asked for', () => {
    expect(parseGeminiImage(answer([{ type: 'image', data: 'SGk=' }]))).toMatchObject({ ok: true, value: { mimeType: 'image/jpeg' } });
  });

  it('R9 a body that is not an object is a server error', () => {
    for (const odd of [null, undefined, 'text', 7, [], { steps: 'no' }]) {
      expect(parseGeminiImage(odd)).toMatchObject({ ok: false, error: { category: 'server' } });
    }
  });

  it('R9 very long refusal text is cut for details', () => {
    const result = parseGeminiImage(answer([{ type: 'text', text: 'x'.repeat(5000) }]));
    expect(result.ok === false && result.error.details?.length).toBe(2000);
  });
});

describe('parseGeminiText (R8)', () => {
  it('R8 returns the text of the model output, trimmed', () => {
    expect(parseGeminiText(answer([{ type: 'text', text: '  A gradient.\n' }]))).toEqual({ ok: true, value: 'A gradient.' });
  });

  it('R8 joins several text parts and ignores other parts', () => {
    expect(parseGeminiText(answer([{ type: 'text', text: 'One.' }, imagePart, { type: 'text', text: ' Two.' }]))).toEqual({ ok: true, value: 'One. Two.' });
  });

  it('R8 no text, or only blanks, is a retryable server error', () => {
    for (const body of [answer([]), answer([{ type: 'text', text: '   ' }]), {}, null]) {
      expect(parseGeminiText(body)).toMatchObject({ ok: false, error: { category: 'server', retryable: true } });
    }
  });
});
