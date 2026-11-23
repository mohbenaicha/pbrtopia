// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

// The old per-material ids as the image in force: one picture on every material, mixed, or none (textures R24).
const inForceOf = (ids: readonly (string | null)[] | null) => {
  if (ids === null) return null;
  const first = ids[0];
  if (first === undefined || first === null) return ids.every((id) => id === null) ? ({ kind: 'none' } as const) : ({ kind: 'mixed' } as const);
  return ids.every((id) => id === first) ? ({ kind: 'picture', id: first } as const) : ({ kind: 'mixed' } as const);
};
function setup(ids: (string | null)[] | null = ['a', 'a'], square: boolean | null = true) {
  const store = createGenerateStore();
  const s = store.getState();
  s.setMaxTextureSize(8192);
  s.setCatalog({ gemini: [known('gemini-nano-banana-2.1')], openai: [], openrouter: [] });
  s.setHasKey('gemini', true);
  s.setSceneState({ hasModel: true, hasUvs: true, albedoInForce: inForceOf(ids), sourceIsSquare: square });
  s.selectModel('gemini', 'gemini-nano-banana-2.1');
  const props = { onGenerate: vi.fn(), onGenerateUv: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onPreviewAtlas: vi.fn(async () => ({ ok: true as const, value: new Blob(['atlas']) })) };
  render(<GeneratePanel projectId="p1" store={store} logStore={createRunLogStore()} today="2026-10-19" {...props} />);
  return { store, props };
}
const choose = (name: string): void => void fireEvent.click(screen.getByRole('radio', { name }));

describe('GeneratePanel with Normal chosen (normal-map R1 to R5)', () => {
  it('normal-map R4 shows Model, Resolution, Quality, Detail and Generate normal map', () => {
    setup();
    choose('Normal');
    for (const name of ['Model', 'Resolution', 'Quality']) expect(screen.getByRole('combobox', { name })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Detail' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate normal map' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Generate' })).toBeNull();
  });

  it('normal-map R4 hides Prompt, references, the Atlas settings, the Custom setup gear and the enhanced-prompt notice', () => {
    const { store } = setup();
    choose('Normal');
    expect(screen.queryByRole('textbox', { name: 'Prompt' })).toBeNull();
    expect(screen.queryByLabelText('Add reference images')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Additional settings' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Atlas size' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Custom setup' })).toBeNull();
    expect(store.getState().channel).toBe('normal');
  });

  it('normal-map R4 going back to Albedo brings the albedo panel back, unchanged', () => {
    setup();
    choose('Normal');
    choose('Albedo');
    expect(screen.getByRole('textbox', { name: 'Prompt' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Custom setup' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeTruthy();
    expect(screen.queryByRole('slider', { name: 'Detail' })).toBeNull();
  });

  it('normal-map R4 Generate normal map starts the run, with no enhancer model needed', () => {
    const { props } = setup();
    choose('Normal');
    const button = screen.getByRole('button', { name: 'Generate normal map' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(props.onGenerate).toHaveBeenCalledTimes(1);
  });

  it('normal-map R4 Generate normal map says why when the chosen model has no key', () => {
    const { store } = setup();
    choose('Normal');
    act(() => store.getState().setHasKey('gemini', false));
    expect((screen.getByRole('button', { name: 'Generate normal map' }) as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector('.generate-button__reason')?.textContent).toMatch(/key/i);
  });

  it('normal-map R5 the Detail slider starts at Medium and a move is kept in the panel', () => {
    const { store } = setup();
    choose('Normal');
    expect(screen.getByRole('status').textContent).toBe('Medium');
    fireEvent.change(screen.getByRole('slider', { name: 'Detail' }), { target: { value: '3' } });
    expect(store.getState().normalDetail).toBe(3);
    expect(screen.getByRole('status').textContent).toBe('Fine');
  });

  it('normal-map R3 removing the albedo while Normal is chosen switches the control to Albedo and the albedo panel returns', () => {
    const { store } = setup();
    choose('Normal');
    expect(screen.getByRole('radio', { name: 'Normal' }).getAttribute('aria-checked')).toBe('true');
    act(() => store.getState().setSceneState({ hasModel: true, hasUvs: true, albedoInForce: { kind: 'none' }, sourceIsSquare: null }));
    expect(screen.getByRole('radio', { name: 'Albedo' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Prompt' })).toBeTruthy();
    expect(screen.queryByText(/albedo picture|Bake or apply/)).toBeNull(); // the panel says nothing else
  });

  it('normal-map R2 without a source albedo Normal cannot be chosen', () => {
    const { store } = setup([null, 'a']);
    choose('Normal');
    expect(store.getState().channel).toBe('albedo');
    expect((screen.getByRole('radio', { name: 'Normal' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('normal-map R2, R11 while a run is going the channel cannot be changed and the progress is the three normal-map steps', () => {
    const { store } = setup();
    choose('Normal');
    act(() => {
      store.getState().beginRun();
      store.getState().setStep('generate', 0);
    });
    for (const radio of screen.getAllByRole('radio')) expect((radio as HTMLButtonElement).disabled).toBe(true);
    expect(within(screen.getByRole('list', { name: 'Progress' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Preparing the islands', 'Generating the height map', 'Building the normal map']);
    expect(screen.queryByText('Capturing views')).toBeNull();
    expect(screen.queryByText('Enhancing prompt')).toBeNull();
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeTruthy();
  });

  it('normal-map R1, mask-generation R1 Metal-Roughness can be chosen when a source albedo exists; its button is Generate masks (more in GeneratePanelMasks)', () => {
    const { store } = setup();
    choose('Metal-Roughness');
    expect(store.getState().channel).toBe('metal-rough');
    expect(screen.getByRole('button', { name: 'Generate masks' })).toBeTruthy();
    expect(screen.queryByText('Metal-Roughness generation is not available yet.')).toBeNull();
  });
});
