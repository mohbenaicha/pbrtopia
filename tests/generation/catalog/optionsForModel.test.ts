import { describe, expect, it } from 'vitest';
import { findKnownModel } from '../../../src/generation/catalog/knownModels';
import { chooseQualityLevel, optionsForModel } from '../../../src/generation/catalog/optionsForModel';
import type { ModelInfo } from '../../../src/generation/catalog/modelTypes';

const known = (provider: 'gemini' | 'openai', id: string): ModelInfo => {
  const info = findKnownModel(provider, id);
  if (!info) throw new Error(`missing ${id}`);
  return info;
};
const unknownModel: ModelInfo = { provider: 'openai', id: 'gpt-image-9', role: 'image', displayName: 'gpt-image-9', verified: false, resolutions: [], qualityLevels: [] };

describe('optionsForModel', () => {
  it('R4 a verified image model offers its sizes and its own quality levels', () => {
    const options = optionsForModel(known('gemini', 'gemini-nano-banana-2.1'), 16384);
    expect(options.resolutions.map((r) => r.key)).toEqual(['1K', '2K', '4K']);
    expect(options.qualityLevels).toEqual(['minimal', 'medium', 'high']);
  });

  it('R4 sizes above the GPU\'s maxTextureSize are dropped, and a size equal to it stays', () => {
    const model = known('gemini', 'gemini-nano-banana-2.1');
    expect(optionsForModel(model, 4096).resolutions.map((r) => r.sizePx)).toEqual([1024, 2048, 4096]);
    expect(optionsForModel(model, 4095).resolutions.map((r) => r.sizePx)).toEqual([1024, 2048]);
    expect(optionsForModel(model, 1024).resolutions.map((r) => r.sizePx)).toEqual([1024]);
    expect(optionsForModel(model, 512).resolutions).toEqual([]);
  });

  it('R4 an OpenAI model offers 1K, 2K and 2.8K (2880) and no 4K', () => {
    const options = optionsForModel(known('openai', 'gpt-image-2.5-sunburst'), 16384);
    expect(options.resolutions.map((r) => r.sizePx)).toEqual([1024, 2048, 2880]);
  });

  it('R5 every level of the selected model is offered, none is renamed or added', () => {
    expect(optionsForModel(known('openai', 'gpt-image-2.5-flare'), 16384).qualityLevels).toEqual(['low', 'medium', 'high', 'xhigh', 'max', 'auto']);
    expect(optionsForModel(known('openai', 'gpt-image-2'), 16384).qualityLevels).toEqual(['low', 'medium', 'high']);
    expect(optionsForModel(known('gemini', 'gemini-3.1-flash-image'), 16384).qualityLevels).toEqual(['minimal', 'high']);
  });

  it('R4, R5 a model that is not in the table offers no sizes and no levels, even if it claims some', () => {
    expect(optionsForModel(unknownModel, 16384)).toEqual({ resolutions: [], qualityLevels: [] });
    const claiming: ModelInfo = { ...unknownModel, resolutions: [{ key: '1K', sizePx: 1024 }], qualityLevels: ['high'] };
    expect(optionsForModel(claiming, 16384)).toEqual({ resolutions: [], qualityLevels: [] });
  });

  it('R4 a text model offers no sizes and no levels', () => {
    expect(optionsForModel(known('openai', 'gpt-6-astra'), 16384)).toEqual({ resolutions: [], qualityLevels: [] });
  });

  it('R4 the model it is given is not changed', () => {
    const model = known('gemini', 'gemini-nano-banana-2.1');
    const before = JSON.stringify(model);
    optionsForModel(model, 1024);
    expect(JSON.stringify(model)).toBe(before);
  });
});

describe('chooseQualityLevel', () => {
  it('R5 the wanted level is kept when the model offers it', () => {
    expect(chooseQualityLevel(known('openai', 'gpt-image-2.5-sunburst'), 'xhigh')).toBe('xhigh');
  });

  it('R5 a level the model lacks is replaced by that model\'s default, with no folding to a near level', () => {
    expect(chooseQualityLevel(known('openai', 'gpt-image-2'), 'xhigh')).toBe('medium');
    expect(chooseQualityLevel(known('gemini', 'gemini-3.1-flash-image'), 'medium')).toBe('minimal');
    expect(chooseQualityLevel(known('openai', 'gpt-image-2.5-flare'), 'minimal')).toBe('auto');
    expect(chooseQualityLevel(known('gemini', 'gemini-nano-banana-2.1'), '')).toBe('medium');
  });

  it('R5 a model with no levels gives null', () => {
    expect(chooseQualityLevel(known('gemini', 'gemini-3-pro-image'), 'high')).toBeNull();
    expect(chooseQualityLevel(unknownModel, 'high')).toBeNull();
  });
});
