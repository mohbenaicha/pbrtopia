import { describe, expect, it } from 'vitest';
import { filterModelIds, type ListedModel } from '../../../src/generation/catalog/filterModelIds';

const TODAY = '2026-10-19';
const ids = (provider: 'gemini' | 'openai', listed: ListedModel[], today = TODAY, method: string | null = null) => filterModelIds(provider, listed, today, method).map((m) => `${m.role}:${m.id}`);
const list = (...names: string[]): ListedModel[] => names.map((id) => ({ id }));

describe('filterModelIds: OpenAI', () => {
  it('R4 keeps gpt-image-* as image models and drops chatgpt-image-* and unrelated ids', () => {
    expect(ids('openai', list('gpt-image-2', 'chatgpt-image-latest', 'gpt-4o', 'dall-e-3', 'whisper-1'))).toEqual(['image:gpt-image-2']);
  });

  it('R4 keeps a vision text model only when it is in the shipped table', () => {
    expect(ids('openai', list('gpt-6-astra', 'gpt-5.6-luna', 'gpt-4o', 'o1-pro'))).toEqual(['vision-text:gpt-5.6-luna']); // astra is not in the table
  });

  it('R4 drops a model whose shutdown date is today or past, and keeps a future one with its date', () => {
    const listed: ListedModel[] = [
      { id: 'gpt-image-1', shutdownDate: '2026-10-01' },
      { id: 'gpt-image-1-mini', shutdownDate: TODAY },
      { id: 'gpt-image-1.5', shutdownDate: '2027-01-15' },
    ];
    const kept = filterModelIds('openai', listed, TODAY, null);
    expect(kept.map((m) => m.id)).toEqual(['gpt-image-1.5']);
    expect(kept[0]?.shutdownDate).toBe('2027-01-15');
  });

  it('R4 a shutdown date that is not a date is ignored', () => {
    expect(ids('openai', [{ id: 'gpt-image-2', shutdownDate: 'soon' }])).toEqual(['image:gpt-image-2']);
  });
});

describe('filterModelIds: Gemini', () => {
  it('R4 keeps image models by name', () => {
    expect(ids('gemini', list('gemini-3.1-flash-image', 'gemini-nano-banana-2.1', 'imagen-4.0-generate', 'text-embedding-004'))).toEqual(['image:gemini-3.1-flash-image', 'image:gemini-nano-banana-2.1']);
  });

  it('R4 keeps flash and pro text models and drops tts, embedding, live and image variants', () => {
    const listed = list('gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3-pro', 'gemini-3.8-flash-tts', 'gemini-embedding-001', 'gemini-3.8-flash-live', 'gemma-3-27b', 'aqa');
    expect(ids('gemini', listed)).toEqual(['vision-text:gemini-3.8-flash', 'vision-text:gemini-3.5-flash-lite', 'vision-text:gemini-3-pro']);
  });

  it('R4 does not check supported methods until the live check names the one that marks Interactions support', () => {
    expect(ids('gemini', [{ id: 'gemini-3.1-flash-image', methods: ['somethingElse'] }])).toEqual(['image:gemini-3.1-flash-image']);
  });

  it('R4 when a method is required an image model must list it', () => {
    const listed: ListedModel[] = [{ id: 'gemini-3.1-flash-image', methods: ['createInteraction'] }, { id: 'gemini-3-pro-image', methods: ['countTokens'] }, { id: 'gemini-nano-banana-2.1' }];
    expect(ids('gemini', listed, TODAY, 'createInteraction')).toEqual(['image:gemini-3.1-flash-image']);
  });
});

describe('filterModelIds: dated and preview duplicates', () => {
  it('R4 a dated snapshot is dropped when the undated id is listed', () => {
    expect(ids('openai', list('gpt-image-2', 'gpt-image-2-2026-04-21'))).toEqual(['image:gpt-image-2']);
    expect(ids('gemini', list('gemini-3.8-flash', 'gemini-3.8-flash-001'))).toEqual(['vision-text:gemini-3.8-flash']);
  });

  it('R4 a preview or experimental id is dropped when the plain id is listed, and kept when it is not', () => {
    expect(ids('gemini', list('gemini-3.8-flash-preview', 'gemini-3.8-flash', 'gemini-3.8-flash-preview-09-2026'))).toEqual(['vision-text:gemini-3.8-flash']);
    expect(ids('gemini', list('gemini-3.9-flash-preview'))).toEqual(['vision-text:gemini-3.9-flash-preview']);
    expect(ids('gemini', list('gemini-3.9-flash-exp'))).toEqual(['vision-text:gemini-3.9-flash-exp']);
  });

  it('R4 a dated snapshot with no undated id listed is kept', () => {
    expect(ids('openai', list('gpt-image-2-2026-04-21'))).toEqual(['image:gpt-image-2-2026-04-21']);
  });
});

describe('filterModelIds: the newest per family', () => {
  it('R4 only the newest version of a family stays', () => {
    expect(ids('openai', list('gpt-image-1', 'gpt-image-1.5', 'gpt-image-2'))).toEqual(['image:gpt-image-2']);
  });

  it('R4 versions compare number by number, not as text', () => {
    expect(ids('gemini', list('gemini-3.10-flash', 'gemini-3.9-flash'))).toEqual(['vision-text:gemini-3.10-flash']);
  });

  it('R4 different families are all kept: Sunburst and Flare both stay beside gpt-image-2', () => {
    const kept = ids('openai', list('gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-2', 'gpt-image-1-mini'));
    expect(kept).toEqual(['image:gpt-image-2.5-sunburst', 'image:gpt-image-2.5-flare', 'image:gpt-image-2', 'image:gpt-image-1-mini']);
  });

  it('R4 a shipped-table model stays when a newer version of its family is listed', () => {
    const kept = ids('openai', list('gpt-image-2.5-sunburst', 'gpt-image-2.6-sunburst', 'gpt-image-2.5-flare', 'gpt-image-2.6-flare'));
    expect(kept).toEqual(['image:gpt-image-2.5-sunburst', 'image:gpt-image-2.6-sunburst', 'image:gpt-image-2.5-flare', 'image:gpt-image-2.6-flare']);
  });

  it('R4 an older id that is not in the table is still dropped beside a newer one', () => {
    expect(ids('openai', list('gpt-image-2.4-sunburst', 'gpt-image-2.6-sunburst'))).toEqual(['image:gpt-image-2.6-sunburst']);
  });

  it('R4 flash, flash-lite and pro are different families', () => {
    const kept = ids('gemini', list('gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3-pro'));
    expect(kept).toEqual(['vision-text:gemini-3.8-flash', 'vision-text:gemini-3.5-flash-lite', 'vision-text:gemini-3-pro']);
  });

  it('R4 an id without a version loses to a numbered one of its family', () => {
    expect(ids('gemini', list('gemini-flash-image', 'gemini-3.1-flash-image'))).toEqual(['image:gemini-3.1-flash-image']);
  });

  it('R4 image and text models never compete', () => {
    expect(ids('gemini', list('gemini-3.1-flash-image', 'gemini-3.8-flash'))).toHaveLength(2);
  });
});

describe('filterModelIds: edge cases', () => {
  it('R4 an empty list gives an empty result', () => {
    expect(filterModelIds('openai', [], TODAY, null)).toEqual([]);
  });

  it('R4 a repeated id appears once', () => {
    expect(ids('openai', list('gpt-image-2', 'gpt-image-2'))).toEqual(['image:gpt-image-2']);
  });

  it('R4 does not change the list it was given', () => {
    const listed = list('gpt-image-2-2026-04-21', 'gpt-image-2');
    const copy = structuredClone(listed);
    filterModelIds('openai', listed, TODAY, null);
    expect(listed).toEqual(copy);
  });
});
