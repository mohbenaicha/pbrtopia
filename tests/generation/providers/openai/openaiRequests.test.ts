import { describe, expect, it } from 'vitest';
import type { ResolutionKey } from '../../../../src/generation/catalog/modelTypes';
import {
  buildOpenAiEnhanceBody,
  buildOpenAiImageForm,
  IMAGE_FIELD,
  OPENAI_EDITS_URL,
  OPENAI_RESPONSES_URL,
} from '../../../../src/generation/providers/openai/openaiRequests';

const png = (name = 'a'): Blob => new Blob([name], { type: 'image/png' });
const base = { model: 'gpt-image-2.5-sunburst', prompt: 'weathered steel', resolutionKey: '2K' as ResolutionKey, sizePx: 2048, quality: 'high' as string | null, atlas: png('atlas'), references: [] as Blob[] };

function formOf(patch: Partial<typeof base> & { canvas?: { width: number; height: number } } = {}): FormData {
  const result = buildOpenAiImageForm({ ...base, ...patch });
  if (!result.ok) throw new Error(`unexpected refusal: ${result.error.category}`);
  return result.value;
}

describe('buildOpenAiImageForm (R7)', () => {
  it('R7 sends the model, prompt, square size, quality and a PNG output format', () => {
    const form = formOf();
    expect(form.get('model')).toBe('gpt-image-2.5-sunburst');
    expect(form.get('prompt')).toBe('weathered steel');
    expect(form.get('size')).toBe('2048x2048');
    expect(form.get('quality')).toBe('high');
    expect(form.get('output_format')).toBe('png');
  });

  it('custom R12 a canvas replaces the square size', () => {
    expect(formOf({ canvas: { width: 1536, height: 1024 } }).get('size')).toBe('1536x1024');
    expect(formOf({ canvas: { width: 1024, height: 2048 } }).get('size')).toBe('1024x2048');
  });

  it('custom R12 a canvas OpenAI cannot return is refused before anything is sent', () => {
    const refused = (width: number, height: number) => buildOpenAiImageForm({ ...base, canvas: { width, height } });
    for (const canvas of [[1000, 1024], [4096, 1024], [4000, 1024], [256, 256], [3840, 3840], [1024, 4096]] as const) {
      expect(refused(canvas[0], canvas[1])).toMatchObject({ ok: false, error: { category: 'bad-request', retryable: false } });
    }
  });

  it('R4 the 2.8K square is 2880x2880', () => {
    expect(formOf({ resolutionKey: '2.8K', sizePx: 2880 }).get('size')).toBe('2880x2880');
  });

  it('R5 sends the chosen quality level unchanged, including xhigh, max and auto', () => {
    for (const level of ['low', 'medium', 'high', 'xhigh', 'max', 'auto']) expect(formOf({ quality: level }).get('quality')).toBe(level);
  });

  it('R5 leaves quality out when the model has no levels', () => {
    expect(formOf({ quality: null }).has('quality')).toBe(false);
  });

  it('R7 sends the atlas first and the references after it, in order, under the one image field', async () => {
    const form = formOf({ references: [new Blob(['r1'], { type: 'image/jpeg' }), new Blob(['r2'], { type: 'image/webp' })] });
    const files = form.getAll(IMAGE_FIELD) as File[];
    expect(files).toHaveLength(3);
    expect(await Promise.all(files.map((file) => file.text()))).toEqual(['atlas', 'r1', 'r2']);
    expect(files.map((file) => file.type)).toEqual(['image/png', 'image/jpeg', 'image/webp']);
    expect(files.map((file) => file.name)).toEqual(['atlas.png', 'reference-1.jpeg', 'reference-2.webp']);
  });

  it('R7 a reference with no type is named as a PNG', () => {
    const files = formOf({ references: [new Blob(['x'])] }).getAll(IMAGE_FIELD) as File[];
    expect(files[1]?.name).toBe('reference-1.png');
  });

  it('R4 refuses 4K (OpenAI has no 4K square) before anything is sent', () => {
    const result = buildOpenAiImageForm({ ...base, resolutionKey: '4K', sizePx: 4096 });
    expect(result).toMatchObject({ ok: false, error: { category: 'bad-request', retryable: false } });
  });

  it('R7 the image field name is the documented repeated field', () => {
    expect(IMAGE_FIELD).toBe('image[]');
  });
});

describe('buildOpenAiEnhanceBody (R8)', () => {
  it('R33 sends one user message with the built enhancer text exactly as given and the atlas as a data URL', () => {
    const body = buildOpenAiEnhanceBody({ model: 'gpt-6-astra', prompt: 'built enhancer text', atlas: { mimeType: 'image/png', base64: 'QVRMQVM=' }, level: null });
    expect(body.model).toBe('gpt-6-astra');
    expect(body.input).toHaveLength(1);
    const message = body.input[0];
    expect(message?.role).toBe('user');
    expect(message?.content[0]).toEqual({ type: 'input_text', text: 'built enhancer text' });
    expect(message?.content[1]).toEqual({ type: 'input_image', image_url: 'data:image/png;base64,QVRMQVM=', detail: 'auto' });
  });

  it('R8 a level is sent as reasoning.effort', () => {
    const body = buildOpenAiEnhanceBody({ model: 'gpt-6-luna', prompt: 'weathered steel', atlas: { mimeType: 'image/png', base64: 'QVRMQVM=' }, level: 'none' });
    expect(body.reasoning).toEqual({ effort: 'none' });
  });

  it('R8 no level sends no reasoning field at all', () => {
    const body = buildOpenAiEnhanceBody({ model: 'gpt-6-astra', prompt: 'weathered steel', atlas: { mimeType: 'image/png', base64: 'QVRMQVM=' }, level: null });
    expect('reasoning' in body).toBe(false);
  });
});

describe('endpoints (R13)', () => {
  it('R13 posts to the documented hosts', () => {
    expect(OPENAI_EDITS_URL).toBe('https://api.openai.com/v1/images/edits');
    expect(OPENAI_RESPONSES_URL).toBe('https://api.openai.com/v1/responses');
  });
});
