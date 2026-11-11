import { describe, expect, it } from 'vitest';
import { buildGeminiEnhanceBody } from '../../../src/generation/providers/gemini/geminiRequests';
import { buildOpenAiEnhanceBody } from '../../../src/generation/providers/openai/openaiRequests';

const IMAGE = { mimeType: 'image/png', base64: 'QVRMQVM=' };

describe('enhance bodies without an image (materialgen generation R72)', () => {
  it('generate R8 an OpenAI enhance body without an image holds the text part alone, and with one is unchanged', () => {
    expect(buildOpenAiEnhanceBody({ model: 'm', prompt: 'p', level: null }).input[0]?.content).toEqual([{ type: 'input_text', text: 'p' }]);
    expect(buildOpenAiEnhanceBody({ model: 'm', prompt: 'p', image: IMAGE, level: 'low' })).toEqual({
      model: 'm',
      input: [{ role: 'user', content: [{ type: 'input_text', text: 'p' }, { type: 'input_image', image_url: 'data:image/png;base64,QVRMQVM=', detail: 'auto' }] }],
      reasoning: { effort: 'low' },
    });
  });

  it('generate R8 a Gemini enhance body without an image holds the text part alone, and with one is unchanged', () => {
    expect(buildGeminiEnhanceBody({ model: 'm', prompt: 'p', level: null }).input).toEqual([{ type: 'text', text: 'p' }]);
    expect(buildGeminiEnhanceBody({ model: 'm', prompt: 'p', image: IMAGE, level: 'low' })).toEqual({
      model: 'm',
      input: [{ type: 'text', text: 'p' }, { type: 'image', mime_type: 'image/png', data: 'QVRMQVM=' }],
      generation_config: { thinking_level: 'low' },
    });
  });
});
