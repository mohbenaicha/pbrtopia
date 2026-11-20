// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findKnownModel } from '../../../src/generation/catalog/knownModels';
import { buildPanelEnhancerKey } from '../../../src/generation/enhancerSnapshot';
import { createGenerateStore } from '../../../src/generation/generateStore';
import { createRunLogStore } from '../../../src/generation/runLogStore';
import { GeneratePanel } from '../../../src/generation/ui/GeneratePanel';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:fake/1');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const NOTICE = 'Reusing the enhanced prompt from the last run.';

function setup() {
  const store = createGenerateStore();
  const s = store.getState();
  s.setMaxTextureSize(8192);
  const model = (id: string) => findKnownModel('gemini', id) ?? (() => { throw new Error(id); })();
  s.setCatalog({ gemini: [model('gemini-nano-banana-2.1'), model('gemini-3-pro-image'), model('gemini-3.8-flash')], openai: [], openrouter: [] });
  s.setHasKey('gemini', true);
  s.setSceneState({ hasModel: true, hasUvs: true });
  s.selectModel('gemini', 'gemini-nano-banana-2.1');
  s.setPrompt('weathered steel');
  const key = buildPanelEnhancerKey(store.getState());
  if (key === null) throw new Error('no key');
  const snapshot = { key, atlasFingerprint: 'fp', enhancedPrompt: 'A scuffed steel plate.' };
  render(<GeneratePanel projectId="p1" store={store} logStore={createRunLogStore()} readImageFile={vi.fn()} today="2026-10-19" onGenerate={vi.fn()} onGenerateUv={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} onPreviewAtlas={vi.fn()} />);
  return { store, snapshot };
}

describe('GeneratePanel: the reuse line (R41)', () => {
  it('R41 shows no line without a snapshot', () => {
    setup();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it('R41 shows the line under the Prompt field when the snapshot matches the panel', () => {
    const { store, snapshot } = setup();
    act(() => store.getState().setEnhancerSnapshot(snapshot));
    const line = screen.getByText(NOTICE);
    const prompt = screen.getByRole('textbox', { name: 'Prompt' });
    expect(prompt.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enhance again' })).toBeTruthy();
  });

  it('custom R15 R41 in Custom the line goes when the plan\'s assigned cameras change, because the overview picture would differ', () => {
    const { store } = setup();
    const settings = { provider: 'gemini' as const, modelId: 'gemini-nano-banana-2.1', resolutionKey: '1K' as const, quality: null };
    act(() => {
      store.getState().setMode('custom');
      store.getState().confirmCustomPlan({ sheets: [{ cameras: [0, 1], settings }], aux: null });
    });
    const key = buildPanelEnhancerKey(store.getState());
    if (key === null) throw new Error('no key');
    act(() => store.getState().setEnhancerSnapshot({ key, atlasFingerprint: 'fp', enhancedPrompt: 'A scuffed steel plate.' }));
    expect(screen.queryByText(NOTICE)).not.toBeNull();
    act(() => store.getState().confirmCustomPlan({ sheets: [{ cameras: [0, 1, 2], settings }], aux: null }));
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it('R41 changing the image model keeps the line', () => {
    const { store, snapshot } = setup();
    act(() => store.getState().setEnhancerSnapshot(snapshot));
    act(() => store.getState().selectModel('gemini', 'gemini-3-pro-image'));
    expect(screen.queryByText(NOTICE)).not.toBeNull();
  });

  it('R41 editing the prompt, the atlas render or the atlas size hides the line', () => {
    const { store, snapshot } = setup();
    act(() => store.getState().setEnhancerSnapshot(snapshot));
    fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), { target: { value: 'weathered steel, rusty' } });
    expect(screen.queryByText(NOTICE)).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), { target: { value: 'weathered steel' } });
    expect(screen.queryByText(NOTICE)).not.toBeNull();
    act(() => store.getState().setAtlasRender('depth'));
    expect(screen.queryByText(NOTICE)).toBeNull();
    act(() => store.getState().setAtlasRender('grey'));
    act(() => store.getState().setAtlasKey('2K')); // the panel starts at 1K
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it('R41 the line is hidden while a run is in progress and back after it', () => {
    const { store, snapshot } = setup();
    act(() => store.getState().setEnhancerSnapshot(snapshot));
    act(() => store.getState().beginRun());
    expect(screen.queryByText(NOTICE)).toBeNull();
    act(() => store.getState().clearRun());
    expect(screen.queryByText(NOTICE)).not.toBeNull();
  });

  it('R41 Enhance again drops the snapshot and the line goes', () => {
    const { store, snapshot } = setup();
    act(() => store.getState().setEnhancerSnapshot(snapshot));
    fireEvent.click(screen.getByRole('button', { name: 'Enhance again' }));
    expect(store.getState().enhancerSnapshot).toBeNull();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });
});
