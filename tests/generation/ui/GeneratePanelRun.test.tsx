// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findKnownModel } from '../../../src/generation/catalog/knownModels';
import { createGenerateStore } from '../../../src/generation/generateStore';
import { GeneratePanel } from '../../../src/generation/ui/GeneratePanel';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:fake/1');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

function setup() {
  const store = createGenerateStore();
  const s = store.getState();
  s.setMaxTextureSize(8192);
  const model = (id: string) => findKnownModel('gemini', id) ?? (() => { throw new Error(id); })();
  s.setCatalog({ gemini: [model('gemini-nano-banana-2.1'), model('gemini-3.8-flash')], openai: [] });
  s.setHasKey('gemini', true);
  s.setSceneState({ hasModel: true, hasUvs: true });
  s.selectModel('gemini', 'gemini-nano-banana-2.1');
  const props = { onGenerate: vi.fn(), onGenerateUv: vi.fn(), onDebugProjection: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn() };
  render(<GeneratePanel store={store} readImageFile={vi.fn()} today="2026-10-19" {...props} />);
  return { store, props };
}

describe('GeneratePanel: a run in flight (R10)', () => {
  it('R10 the step list and Cancel replace the Generate button while a run is in flight', () => {
    const { store } = setup();
    act(() => store.getState().beginRun());
    expect(screen.getByRole('list', { name: 'Progress' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Generate' })).toBeNull();
    act(() => store.getState().setStep('enhance', 0.5));
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
  });

  it('R10 Cancel calls onCancel and the other fields stay editable', () => {
    const { store, props } = setup();
    act(() => store.getState().beginRun());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), { target: { value: 'edited while running' } });
    expect(store.getState().prompt).toBe('edited while running');
  });

  it('R10 the Generate button is back after the run is cleared', () => {
    const { store } = setup();
    act(() => store.getState().beginRun());
    act(() => store.getState().clearRun());
    expect(screen.queryByRole('list', { name: 'Progress' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeTruthy();
  });

  it('R15 a request in flight with no step (the unwrap) keeps the button, disabled with its reason', () => {
    const { store } = setup();
    act(() => store.getState().setSceneState({ hasModel: true, hasUvs: false }));
    act(() => store.setState({ status: 'running' }));
    expect(screen.queryByRole('list', { name: 'Progress' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Generate UV' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('GeneratePanel: a failed run (R9)', () => {
  const fail = (store: ReturnType<typeof createGenerateStore>, retryable = true) => {
    act(() => store.getState().beginRun());
    act(() => store.getState().setStep('generate', 0.2));
    act(() => store.getState().failRun({ category: retryable ? 'server' : 'moderation', retryable, message: 'It failed.' }));
  };

  it('R9 the error is shown with Retry, the failed step is marked and the Generate button stays usable', () => {
    const { store, props } = setup();
    fail(store);
    expect(screen.getByRole('alert').textContent).toContain('It failed.');
    expect(screen.getAllByRole('listitem').map((item) => item.getAttribute('data-state'))).toEqual(['done', 'done', 'failed', 'pending']);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(props.onGenerate).toHaveBeenCalledTimes(1);
  });

  it('R9 a failure leaves the prompt and settings as they were', () => {
    const { store } = setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), { target: { value: 'keep me' } });
    fail(store);
    expect(store.getState()).toMatchObject({ prompt: 'keep me', modelId: 'gemini-nano-banana-2.1', resolutionKey: '2K' });
  });

  it('R9 a cancelled run shows no error', () => {
    const { store } = setup();
    act(() => store.getState().beginRun());
    act(() => store.getState().failRun({ category: 'aborted', retryable: false, message: '' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('R9 clearing the run removes the error', () => {
    const { store } = setup();
    fail(store);
    act(() => store.getState().clearRun());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('GeneratePanel: the enhanced prompt (R12)', () => {
  it('R12 shows the enhanced prompt once there is one, and keeps it after the run is cleared', () => {
    const { store } = setup();
    expect(screen.queryByText('Enhanced prompt')).toBeNull();
    act(() => store.getState().beginRun());
    act(() => store.getState().setEnhancedPrompt('A stone with moss on the left.'));
    expect(screen.getByText('A stone with moss on the left.')).toBeTruthy();
    act(() => store.getState().clearRun());
    expect(screen.getByText('A stone with moss on the left.')).toBeTruthy();
  });
});
