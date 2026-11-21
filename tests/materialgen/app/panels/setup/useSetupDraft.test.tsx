// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildModelCatalog } from '@shared/shell';
import { buildCardSettings, buildPresetPlan, type GenerationPlan } from '@mat/generation';
import { useSetupDraft } from '@mat/app/panels/setup/useSetupDraft';
import { withKnownModels } from '@mat/generation/plan/displayCatalog';

const MAX_TEXTURE = 4096;
const catalog = buildModelCatalog(['gemini', 'openai']);
const environment = { catalog, hasKey: { gemini: true, openai: true, openrouter: false }, describeProvider: 'gemini' as const, referenceCount: 0, hasExistingAlbedo: false };
const start: GenerationPlan = buildPresetPlan('preset-1', catalog, MAX_TEXTURE)!;
const openaiModel = catalog.openai[0]!;
const picked = buildCardSettings(openaiModel, MAX_TEXTURE, 1);

const mountDraft = () => renderHook(() => useSetupDraft({ start, environment, displayCatalog: withKnownModels(catalog), maxTextureSize: MAX_TEXTURE }));

describe('materialgen/generation setup draft', () => {
  it('R17 Sync is off at first: a change on one card leaves the others as they were', () => {
    const { result } = mountDraft();
    expect(result.current.sync).toBe(false);
    act(() => result.current.changeCard(1, picked));
    expect(result.current.plan.images[1]!.settings.provider).toBe('openai');
    expect(result.current.plan.images[0]!.settings).toEqual(start.images[0]!.settings);
    expect(result.current.plan.decomposition).toEqual(start.decomposition);
  });

  it('R17 with Sync on a change on any card goes to every other card, the Metal-Roughness card included, retargeted for its own maps', () => {
    const { result } = mountDraft();
    act(() => result.current.setSync(true));
    act(() => result.current.changeCard(1, picked));
    expect(result.current.plan.images.map((image) => image.settings.modelId)).toEqual(Array(start.images.length).fill(openaiModel.id));
    expect(result.current.plan.decomposition?.modelId).toBe(openaiModel.id);
    expect(result.current.plan.images[0]!.settings.resolutionKey).toBe(picked.resolutionKey);
  });

  it('R17 turning Sync on copies the lead card to every card at once', () => {
    const { result } = mountDraft();
    act(() => result.current.changeCard(0, picked));
    expect(result.current.plan.images[1]!.settings.provider).toBe('gemini');
    act(() => result.current.setSync(true));
    expect(result.current.plan.images.every((image) => image.settings.modelId === openaiModel.id)).toBe(true);
    expect(result.current.plan.decomposition?.modelId).toBe(openaiModel.id);
  });

  it('R13 two edits made before a re-render both land', () => {
    const { result } = mountDraft();
    act(() => {
      result.current.changeCard(0, picked);
      result.current.changeCard(1, picked);
    });
    expect(result.current.plan.images[0]!.settings.provider).toBe('openai');
    expect(result.current.plan.images[1]!.settings.provider).toBe('openai');
  });

  it('R11 Albedo moves and unassigns like the others; Height moves between cards', () => {
    const { result } = mountDraft();
    act(() => result.current.assign('albedo', 1));
    expect(result.current.plan.images.map((image) => image.maps)).toEqual([[], ['albedo', 'height']]);
    act(() => result.current.unassign('albedo'));
    expect(result.current.plan.images.map((image) => image.maps)).toEqual([[], ['height']]);
    act(() => result.current.assign('height', 0));
    expect(result.current.plan.images[0]!.maps).toEqual(['height']);
    expect(result.current.plan.images[1]!.maps).toEqual([]);
  });

  it('R13 Image 1 can be removed, and with every card gone a new card and the Include box still start from a model', () => {
    const { result } = mountDraft();
    act(() => result.current.removeCard(0));
    expect(result.current.plan.images.map((image) => image.maps)).toEqual([['height']]);
    act(() => result.current.removeCard(0));
    expect(result.current.plan.images).toEqual([]);
    act(() => result.current.addCard());
    expect(result.current.plan.images).toHaveLength(1);
    expect(result.current.plan.images[0]!.settings).toEqual(start.decomposition);
    act(() => result.current.removeCard(0));
    act(() => result.current.setIncluded(false));
    act(() => result.current.setIncluded(true));
    expect(result.current.plan.decomposition?.provider).toBe('openai'); // nothing left to start from: the GPT Image default
  });

  it('R5 R18 a draft with no map and no Metal-Roughness card has nothing to generate', () => {
    const { result } = mountDraft();
    act(() => result.current.setIncluded(false));
    for (let index = 0; index < 2; index += 1) act(() => result.current.removeCard(0));
    expect(result.current.report.problem).toBe('Nothing to generate.');
  });

  it('R15 unticking Include drops the Metal-Roughness card and ticking it again starts from the lead model', () => {
    const { result } = mountDraft();
    act(() => result.current.setIncluded(false));
    expect(result.current.plan.decomposition).toBeNull();
    expect(result.current.report.cards.some((card) => card.card === 'decomposition')).toBe(false);
    act(() => result.current.setIncluded(true));
    expect(result.current.plan.decomposition?.modelId).toBe(start.images[0]!.settings.modelId);
  });

  it('R18 the report judges the draft: a card that moves out of reach of its key shows its problem and Confirm would be off', () => {
    const { result } = renderHook(() =>
      useSetupDraft({ start, environment: { ...environment, hasKey: { gemini: true, openai: false, openrouter: false } }, displayCatalog: withKnownModels(catalog), maxTextureSize: MAX_TEXTURE }),
    );
    expect(result.current.report.problem).toBeNull();
    act(() => result.current.changeCard(1, picked));
    expect(result.current.report.problem).toMatch(/OpenAI key/);
  });
});
