// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findKnownModel } from '../../../src/generation/catalog/knownModels';
import { createGenerateStore } from '../../../src/generation/generateStore';
import { createRunLogStore } from '../../../src/generation/runLogStore';
import { GeneratePanel } from '../../../src/generation/ui/GeneratePanel';

beforeEach(() => {
  let count = 0;
  URL.createObjectURL = vi.fn(() => `blob:fake/${++count}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

function setup(projectId = 'p1') {
  const store = createGenerateStore();
  const s = store.getState();
  s.setMaxTextureSize(8192);
  const model = (id: string) => findKnownModel('gemini', id) ?? (() => { throw new Error(id); })();
  s.setCatalog({ gemini: [model('gemini-nano-banana-2.1'), model('gemini-3.8-flash')], openai: [], openrouter: [] });
  s.setHasKey('gemini', true);
  s.setSceneState({ hasModel: true, hasUvs: true });
  s.selectModel('gemini', 'gemini-nano-banana-2.1');
  const logStore = createRunLogStore();
  render(<GeneratePanel projectId={projectId} store={store} logStore={logStore} readImageFile={vi.fn()} today="2026-10-19" onGenerate={vi.fn()} onGenerateUv={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} onPreviewAtlas={vi.fn()} />);
  return { store, logStore };
}

const begin = (logStore: ReturnType<typeof createRunLogStore>, projectId = 'p1', modelLabel = 'Nano Banana') =>
  logStore.getState().begin({ projectId, modelLabel, prompt: 'a mossy stone', startedAt: Date.now() });

const generateTab = () => screen.getByRole('tab', { name: 'Generate' });
const debugTab = () => screen.getByRole('tab', { name: 'Debug' });

describe('GeneratePanel: the Generate and Debug tabs (R23)', () => {
  it('R23 opens on the Generate tab with all the fields, and the Debug tab is a compact bug icon named Debug', () => {
    setup();
    expect(generateTab().getAttribute('aria-selected')).toBe('true');
    expect(debugTab().getAttribute('aria-selected')).toBe('false');
    expect(debugTab().hasAttribute('data-compact')).toBe(true);
    expect(debugTab().textContent).toBe('');
    expect(screen.getByRole('textbox', { name: 'Prompt' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeTruthy();
    expect(screen.getByText('No generations for this project yet.').closest('[hidden]')).not.toBeNull();
  });

  it('R23 the Debug tab shows the run log and hides the fields', () => {
    setup();
    fireEvent.click(debugTab());
    expect(debugTab().getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('No generations for this project yet.')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Prompt' })).toBeNull();
  });

  it('R23 going to Debug and back keeps what was typed and the same prompt field', () => {
    setup();
    const prompt = screen.getByRole('textbox', { name: 'Prompt' }) as HTMLTextAreaElement;
    fireEvent.change(prompt, { target: { value: 'half written' } });
    fireEvent.click(debugTab());
    fireEvent.click(generateTab());
    const back = screen.getByRole('textbox', { name: 'Prompt' }) as HTMLTextAreaElement;
    expect(back).toBe(prompt);
    expect(back.value).toBe('half written');
  });

  it('R23 a row opened in the Debug tab stays open after a visit to the Generate tab', () => {
    const { logStore } = setup();
    begin(logStore);
    fireEvent.click(debugTab());
    fireEvent.click(screen.getByRole('button', { name: /Nano Banana/ }));
    fireEvent.click(generateTab());
    fireEvent.click(debugTab());
    expect(screen.getByRole('button', { name: /Nano Banana/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('R23 a run that fails brings the Generate tab forward so the error is seen', () => {
    const { store } = setup();
    act(() => store.getState().beginRun());
    fireEvent.click(debugTab());
    act(() => store.getState().setStep('generate', 0.2));
    act(() => store.getState().failRun({ category: 'server', retryable: true, message: 'It failed.' }));
    expect(generateTab().getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('It failed.');
  });

  it('R23 a run that is still going does not pull the user back from the Debug tab', () => {
    const { store } = setup();
    fireEvent.click(debugTab());
    act(() => store.getState().beginRun());
    act(() => store.getState().setStep('generate', 0.2));
    expect(debugTab().getAttribute('aria-selected')).toBe('true');
  });

  it('R23 the arrow keys move between the two tabs', () => {
    setup();
    fireEvent.keyDown(generateTab(), { key: 'ArrowRight' });
    expect(debugTab().getAttribute('aria-selected')).toBe('true');
  });
});

describe('GeneratePanel: the run log in the panel (R24, R26)', () => {
  it('R26 shows only the open project\'s rows and reacts to the log changing', () => {
    const { logStore } = setup('p1');
    begin(logStore, 'p1', 'Mine');
    begin(logStore, 'p2', 'Theirs');
    fireEvent.click(debugTab());
    expect(screen.getByRole('button', { name: /Mine/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Theirs/ })).toBeNull();
    act(() => void begin(logStore, 'p1', 'Later'));
    expect(screen.getByRole('button', { name: /Later/ })).toBeTruthy();
  });

  it('R26 Delete log row removes the row from the log', () => {
    const { logStore } = setup();
    const id = begin(logStore);
    logStore.getState().finish(id, 'done');
    fireEvent.click(debugTab());
    fireEvent.click(screen.getByRole('button', { name: 'Delete log row' }));
    expect(logStore.getState().records).toEqual([]);
    expect(screen.getByText('No generations for this project yet.')).toBeTruthy();
  });
});

describe('GeneratePanel: the link from the step list to its row (R27)', () => {
  const inFlight = (store: ReturnType<typeof createGenerateStore>) => {
    act(() => store.getState().beginRun());
    act(() => store.getState().setStep('generate', 0.2));
  };

  it('R27 View log chooses the Debug tab and opens the run\'s row', () => {
    const { store, logStore } = setup();
    begin(logStore, 'p1', 'Older');
    begin(logStore, 'p1', 'Current');
    inFlight(store);
    fireEvent.click(screen.getByRole('button', { name: 'View log' }));
    expect(debugTab().getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: /Current/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /Older/ }).getAttribute('aria-expanded')).toBe('false');
  });

  it('R27 rows already open stay open', () => {
    const { store, logStore } = setup();
    begin(logStore, 'p1', 'Older');
    begin(logStore, 'p1', 'Current');
    fireEvent.click(debugTab());
    fireEvent.click(screen.getByRole('button', { name: /Older/ }));
    fireEvent.click(generateTab());
    inFlight(store);
    fireEvent.click(screen.getByRole('button', { name: 'View log' }));
    expect(screen.getByRole('button', { name: /Older/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /Current/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('R27 clicking it again after closing the row opens it again', () => {
    const { store, logStore } = setup();
    begin(logStore);
    inFlight(store);
    fireEvent.click(screen.getByRole('button', { name: 'View log' }));
    fireEvent.click(screen.getByRole('button', { name: /Nano Banana/ }));
    fireEvent.click(generateTab());
    fireEvent.click(screen.getByRole('button', { name: 'View log' }));
    expect(screen.getByRole('button', { name: /Nano Banana/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('R27 with no row for this project there is no link', () => {
    const { store, logStore } = setup('p1');
    begin(logStore, 'p2');
    inFlight(store);
    expect(screen.queryByRole('button', { name: 'View log' })).toBeNull();
  });

  it('R27 a failed run shows the link on its failed step', () => {
    const { store, logStore } = setup();
    begin(logStore);
    inFlight(store);
    act(() => store.getState().failRun({ category: 'server', retryable: true, message: 'It failed.' }));
    expect(screen.getAllByRole('button', { name: 'View log' })).toHaveLength(2);
  });
});
