// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findKnownModel } from '../../../src/generation/catalog/knownModels';
import { createGenerateStore } from '../../../src/generation/generateStore';
import { createRunLogStore } from '../../../src/generation/runLogStore';
import { GeneratePanel } from '../../../src/generation/ui/GeneratePanel';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:fake/1');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const known = (id: string) => {
  const entry = findKnownModel('gemini', id);
  if (entry === null) throw new Error(`${id} is not in the table`);
  return entry;
};
const settings = { provider: 'gemini' as const, modelId: 'gemini-nano-banana-2.1', resolutionKey: '1K' as const, quality: null };

function setup(channel: 'albedo' | 'normal' | 'metal-rough' = 'albedo') {
  const store = createGenerateStore();
  const s = store.getState();
  s.setMaxTextureSize(8192);
  s.setCatalog({ gemini: [known('gemini-nano-banana-2.1'), known('gemini-3.8-flash')], openai: [], openrouter: [] });
  s.setHasKey('gemini', true);
  s.setSceneState({ hasModel: true, hasUvs: true, albedoInForce: { kind: 'picture', id: 'a' }, sourceIsSquare: true });
  s.selectModel('gemini', 'gemini-nano-banana-2.1');
  const props = { onGenerate: vi.fn(), onGenerateUv: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onPreviewAtlas: vi.fn(), onSetUpCustom: vi.fn() };
  render(<GeneratePanel projectId="p1" store={store} logStore={createRunLogStore()} today="2026-10-19" {...props} />);
  if (channel === 'metal-rough') fireEvent.click(screen.getByRole('radio', { name: 'Metal-Roughness' }));
  if (channel === 'normal') fireEvent.click(screen.getByRole('radio', { name: 'Normal' }));
  return { store, props };
}

const rowOf = (element: HTMLElement): Element | null => element.closest('.generate-panel__actions');
const exitButton = (): HTMLButtonElement | null => screen.queryByRole('button', { name: 'Exit custom setup' });

describe('GeneratePanel: the Exit custom setup button (custom R1)', () => {
  it('custom R1 Standard shows no Exit custom setup button', () => {
    setup();
    expect(exitButton()).toBeNull();
  });

  it('custom R1 Custom shows the X after the gear on the Generate button\'s row', () => {
    const { store } = setup();
    act(() => store.getState().setMode('custom'));
    const gear = screen.getByRole('button', { name: 'Custom setup' });
    const exit = exitButton()!;
    expect(exit).not.toBeNull();
    expect(rowOf(exit)).toBe(rowOf(gear));
    expect(rowOf(exit)).toBe(rowOf(screen.getByRole('button', { name: /^Generate/ })));
    expect(gear.compareDocumentPosition(exit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('custom R1 the X is the line-icon set\'s close mark', () => {
    const { store } = setup();
    act(() => store.getState().setMode('custom'));
    expect(exitButton()!.querySelector('svg path[d="M6 6l12 12"]')).not.toBeNull();
  });

  it('custom R1 clicking the X switches to Standard without opening the setup, keeps the stored plan and brings the fields back', () => {
    const { store, props } = setup();
    const plan = { sheets: [{ cameras: [0, 1], settings }], aux: null };
    act(() => {
      store.getState().confirmCustomPlan(plan);
      store.getState().setMode('custom');
    });
    for (const name of ['Model', 'Resolution', 'Quality']) expect(screen.queryByRole('combobox', { name })).toBeNull();
    fireEvent.click(exitButton()!);
    expect(store.getState().mode).toBe('standard');
    expect(store.getState().customPlan).toEqual(plan);
    expect(props.onSetUpCustom).not.toHaveBeenCalled();
    expect(exitButton()).toBeNull();
    for (const name of ['Model', 'Resolution', 'Quality']) expect(screen.getByRole('combobox', { name })).toBeTruthy();
  });

  it('custom R1 the X and the gear are disabled while a run is going', () => {
    const { store } = setup();
    act(() => store.getState().setMode('custom'));
    act(() => store.getState().beginRun());
    expect(exitButton()!.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Custom setup' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('custom R1 the Normal channel keeps Model, Resolution and Quality in Custom and has neither gear nor X', () => {
    const { store } = setup('normal');
    act(() => store.getState().setMode('custom'));
    for (const name of ['Model', 'Resolution', 'Quality']) expect(screen.getByRole('combobox', { name })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Custom setup' })).toBeNull();
    expect(exitButton()).toBeNull();
  });
});

describe('GeneratePanel: one action row (custom R1, generate R10)', () => {
  it('generate R10 while a run is going Cancel takes the Generate button\'s place on the row of the gear, not under the step list', () => {
    const { store } = setup();
    act(() => {
      store.getState().beginRun();
      store.getState().setStep('enhance', 0.3);
    });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(rowOf(cancel)).toBe(rowOf(screen.getByRole('button', { name: 'Custom setup' })));
    expect(cancel.closest('.progress-steps')).toBeNull();
    expect(cancel.compareDocumentPosition(screen.getByRole('button', { name: 'Custom setup' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Generate/ })).toBeNull();
  });

  it('generate R10 Cancel calls onCancel and says the provider may still bill once the image step is on', () => {
    const { store, props } = setup();
    act(() => {
      store.getState().beginRun();
      store.getState().setStep('generate', 0.1);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel (may still be billed)' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('generate R9 a failed run has no Cancel; the Generate button is back on the row', () => {
    const { store } = setup();
    act(() => {
      store.getState().beginRun();
      store.getState().setStep('generate', 0.1);
      store.getState().failRun({ category: 'engine', retryable: true, message: 'Boom.' });
    });
    expect(screen.queryByRole('button', { name: /^Cancel/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Generate/ })).toBeTruthy();
  });

  it('custom R1 the row wraps so the gear and the X drop to a second row before the first button is clipped', () => {
    const css = readFileSync('src/generation/ui/GeneratePanel.css', 'utf8');
    const rule = /\.generate-panel__actions\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/flex-wrap:\s*wrap/);
    const button = /\.generate-button\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(button).toMatch(/flex:\s*1 0 /); // grows, never shrinks below its basis
  });
});

describe('GeneratePanel on Metal-Roughness (mask-generation R2, custom R1)', () => {
  it('mask-generation R2 shows the Custom setup gear; it switches to Custom and opens the setup', () => {
    const { store, props } = setup('metal-rough');
    fireEvent.click(screen.getByRole('button', { name: 'Custom setup' }));
    expect(props.onSetUpCustom).toHaveBeenCalledTimes(1);
    expect(store.getState().mode).toBe('custom');
  });

  it('mask-generation R2 in Custom the Model, Resolution and Quality fields give way and the X shows; the X brings them back', () => {
    const { store } = setup('metal-rough');
    act(() => store.getState().setMode('custom'));
    for (const name of ['Model', 'Resolution', 'Quality']) expect(screen.queryByRole('combobox', { name })).toBeNull();
    expect(screen.getByText('Describe the materials (optional)')).toBeTruthy();
    fireEvent.click(exitButton()!);
    for (const name of ['Model', 'Resolution', 'Quality']) expect(screen.getByRole('combobox', { name })).toBeTruthy();
  });

  it('mask-generation R2 the gear and the X sit on the row of Generate masks', () => {
    const { store } = setup('metal-rough');
    act(() => store.getState().setMode('custom'));
    expect(rowOf(exitButton()!)).toBe(rowOf(screen.getByRole('button', { name: /^Generate masks/ })));
    expect(rowOf(screen.getByRole('button', { name: 'Custom setup' }))).toBe(rowOf(exitButton()!));
  });
});

describe('GeneratePanel: progress of a custom mask run (mask-generation R21)', () => {
  it('mask-generation R21 the generate step counts the plan\'s sheets, not the auxiliary image the run does not make', () => {
    const { store } = setup('metal-rough');
    act(() => {
      store.getState().setMode('custom');
      store.getState().confirmCustomPlan({ sheets: [{ cameras: [0, 1], settings }, { cameras: [2], settings }], aux: { settings } });
      store.getState().beginRun();
      store.getState().setStep('generate', 0.5);
    });
    expect(screen.getByText(/Painting the masks \(1 of 2\)/)).toBeTruthy();
  });
});
