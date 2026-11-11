import { describe, expect, it, vi } from 'vitest';
import type { PromptEnhancer } from '@shared/generation';
import { askDescribeModel } from '@mat/app/project/askDescribeModel';

const target = { provider: 'openai' as const, modelId: 'gpt-6-luna', level: 'low' };
const image = new Blob(['png']);
const live = new AbortController().signal;

function enhancer(answer: Awaited<ReturnType<PromptEnhancer['enhance']>>): { enhancer: PromptEnhancer; enhance: ReturnType<typeof vi.fn> } {
  const enhance = vi.fn(async () => answer);
  return { enhancer: { enhance }, enhance };
}

describe('materialgen/masks describe call binding', () => {
  it('R1 the text and the image go to the chosen vision-text model with its key, level and the run\'s signal', async () => {
    const fake = enhancer({ ok: true, value: '[]' });
    const ask = askDescribeModel({ target, keys: { getKey: () => 'sk-test' }, createPromptEnhancer: () => fake.enhancer });
    expect(await ask('describe this', image, live)).toEqual({ ok: true, value: '[]' });
    expect(fake.enhance).toHaveBeenCalledWith({ model: 'gpt-6-luna', prompt: 'describe this', image, level: 'low' }, { apiKey: 'sk-test', signal: live });
  });

  it('R64 R67 with no vision-text model chosen the step says what to do and makes no call', async () => {
    const fake = enhancer({ ok: true, value: '' });
    const ask = askDescribeModel({ target: null, keys: { getKey: () => 'sk-test' }, createPromptEnhancer: () => fake.enhancer });
    const result = await ask('x', image, live);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/Settings > Models/);
    expect(fake.enhance).not.toHaveBeenCalled();
  });

  it('R64 R67 with no key for the provider the step names the key to add and makes no call', async () => {
    const fake = enhancer({ ok: true, value: '' });
    const ask = askDescribeModel({ target, keys: { getKey: () => null }, createPromptEnhancer: () => fake.enhancer });
    expect(await ask('x', image, live)).toEqual({ ok: false, message: 'Add your OpenAI key in Settings > Keys' });
    expect(fake.enhance).not.toHaveBeenCalled();
  });

  it('R67 a provider error comes back as its message', async () => {
    const fake = enhancer({ ok: false, error: { category: 'auth', retryable: false, message: 'The model refused.' } });
    const ask = askDescribeModel({ target, keys: { getKey: () => 'sk-test' }, createPromptEnhancer: () => fake.enhancer });
    expect(await ask('x', image, live)).toEqual({ ok: false, message: 'The model refused.' });
  });
});
