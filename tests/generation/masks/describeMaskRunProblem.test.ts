import { describe, expect, it } from 'vitest';
import { describeMaskRunProblem, NO_DESCRIBE_MODEL } from '../../../src/generation/masks/describeMaskRunProblem';

const model = { provider: 'openai' as const, modelId: 'gpt-6-luna' };

describe('describeMaskRunProblem (mask-generation R1)', () => {
  it('mask-generation R1 an enabled channel with a describe model and its key has no problem', () => {
    expect(describeMaskRunProblem({ channelAvailability: { enabled: true }, describeModel: model, keyPresent: true })).toBeNull();
  });

  it('mask-generation R1 a channel that is not available gives its own reason (normal-map R2) before anything else', () => {
    expect(describeMaskRunProblem({ channelAvailability: { enabled: false, reason: 'Bake or apply one albedo to the whole model first.' }, describeModel: null, keyPresent: false })).toBe('Bake or apply one albedo to the whole model first.');
  });

  it('mask-generation R1 without a describe model the run says so, with the exact sentence', () => {
    expect(NO_DESCRIBE_MODEL).toBe('No model can describe the pictures. Add a Gemini or OpenAI key.');
    expect(describeMaskRunProblem({ channelAvailability: { enabled: true }, describeModel: null, keyPresent: false })).toBe(NO_DESCRIBE_MODEL);
  });

  it('mask-generation R1 a describe model whose key is missing counts as no model', () => {
    expect(describeMaskRunProblem({ channelAvailability: { enabled: true }, describeModel: model, keyPresent: false })).toBe(NO_DESCRIBE_MODEL);
  });
});
