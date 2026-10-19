import { describe, expect, it } from 'vitest';
import { parseOpenAiImage, parseOpenAiText } from '../../../../src/generation/providers/openai/openaiResponses';

describe('parseOpenAiImage (R7)', () => {
  it('R7 returns the base64 of data[0].b64_json as a PNG', () => {
    expect(parseOpenAiImage({ data: [{ b64_json: 'SGk=' }] })).toEqual({ ok: true, value: { base64: 'SGk=', mimeType: 'image/png' } });
  });

  it('R9 an answer with no image is a retryable server error', () => {
    for (const body of [{}, { data: [] }, { data: [{}] }, { data: [{ b64_json: '' }] }, { data: 'no' }, null, 'text', 3, []]) {
      expect(parseOpenAiImage(body)).toMatchObject({ ok: false, error: { category: 'server', retryable: true } });
    }
  });
});

describe('parseOpenAiText (R8)', () => {
  const message = (...content: unknown[]) => ({ output: [{ type: 'reasoning' }, { type: 'message', content }] });

  it('R8 returns the output_text of the message, trimmed', () => {
    expect(parseOpenAiText(message({ type: 'output_text', text: ' A steel plate. ' }))).toEqual({ ok: true, value: 'A steel plate.' });
  });

  it('R8 joins several output_text parts and ignores other parts and other items', () => {
    const body = { output: [{ type: 'message', content: [{ type: 'output_text', text: 'One.' }, { type: 'refusal', refusal: 'x' }] }, { type: 'message', content: [{ type: 'output_text', text: ' Two.' }] }] };
    expect(parseOpenAiText(body)).toEqual({ ok: true, value: 'One. Two.' });
  });

  it('R8 no text, blank text or an odd body is a retryable server error', () => {
    for (const body of [message(), message({ type: 'output_text', text: '  ' }), { output: [] }, {}, null, 'x', { output: 'no' }]) {
      expect(parseOpenAiText(body)).toMatchObject({ ok: false, error: { category: 'server', retryable: true } });
    }
  });
});
