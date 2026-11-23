// @vitest-environment jsdom
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

const known = (provider: 'gemini' | 'openai', id: string) => {
  const entry = findKnownModel(provider, id);
  if (entry === null) throw new Error(`${id} is not in the table`);
  return entry;
};

function setup(describeKey = true) {
  const store = createGenerateStore();
  const s = store.getState();
  s.setMaxTextureSize(8192);
  s.setCatalog({ gemini: [known('gemini', 'gemini-nano-banana-2.1'), known('gemini', 'gemini-3.8-flash')], openai: [], openrouter: [] });
  s.setHasKey('gemini', describeKey);
  s.setSceneState({ hasModel: true, hasUvs: true, albedoPictureIds: ['a', 'a'], sourceIsSquare: true });
  s.selectModel('gemini', 'gemini-nano-banana-2.1');
  const props = { onGenerate: vi.fn(), onGenerateUv: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onPreviewAtlas: vi.fn(async () => ({ ok: true as const, value: new Blob(['atlas']) })) };
  render(<GeneratePanel projectId="p1" store={store} logStore={createRunLogStore()} today="2026-10-19" {...props} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Metal-Roughness' }));
  return { store, props };
}

describe('GeneratePanel with Metal-Roughness chosen (mask-generation R1, R2)', () => {
  it('mask-generation R2 shows Describe the materials (optional), Model, Resolution, Quality, Atlas size and the button Generate masks', () => {
    setup();
    expect(screen.getByText('Describe the materials (optional)')).toBeTruthy();
    expect(screen.queryByText('Prompt')).toBeNull();
    for (const name of ['Model', 'Resolution', 'Quality']) expect(screen.getByRole('combobox', { name })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Additional settings' }));
    expect(screen.getByRole('combobox', { name: 'Atlas size' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate masks' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Generate' })).toBeNull();
  });

  it('mask-generation R2 hides the references and Tile borders, and shows the Custom setup gear', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Additional settings' }));
    expect(screen.queryByLabelText('Add reference images')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Tile borders' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Custom setup' })).toBeTruthy();
  });

  it('mask-generation R2 shows the Atlas render row fixed to Color (unlit albedo) and disabled, and the Preview atlas eye beside it in Standard', () => {
    const { store } = setup();
    store.getState().setAtlasRender('wireframe'); // the Albedo channel's choice is neither shown nor changed
    fireEvent.click(screen.getByRole('button', { name: 'Additional settings' }));
    const render = screen.getByRole('combobox', { name: 'Atlas render' }) as HTMLButtonElement;
    expect(render.textContent).toContain('Color (unlit albedo)');
    expect(render.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Preview atlas' })).toBeTruthy();
    expect(store.getState().atlasRender).toBe('wireframe');
  });

  it('mask-generation R2 in Custom the render row stays, with no Preview atlas eye and no Atlas size', () => {
    const { store } = setup();
    act(() => store.getState().setMode('custom'));
    fireEvent.click(screen.getByRole('button', { name: 'Additional settings' }));
    expect(screen.getByRole('combobox', { name: 'Atlas render' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Preview atlas' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Atlas size' })).toBeNull();
  });

  it('mask-generation R23 the eye of Metal-Roughness asks the app for the preview', async () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Additional settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview atlas' }));
    await vi.waitFor(() => expect(props.onPreviewAtlas).toHaveBeenCalledTimes(1));
  });

  it('mask-generation R2 the describe field is the prompt of the store, and a saved tile border is not changed by choosing masks', () => {
    const { store } = setup();
    store.getState().setTileBorder(true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a worn chest' } });
    expect(store.getState().prompt).toBe('a worn chest');
    expect(store.getState().tileBorder).toBe(true);
  });

  it('mask-generation R1 Generate masks starts the run when a describe model exists', () => {
    const { props } = setup();
    const button = screen.getByRole('button', { name: 'Generate masks' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(props.onGenerate).toHaveBeenCalledTimes(1);
  });

  it('mask-generation R1 without a describe model the button is disabled with the reason', () => {
    const { store, props } = setup();
    act(() => store.getState().setCatalog({ gemini: [known('gemini', 'gemini-nano-banana-2.1')], openai: [], openrouter: [] }));
    const button = screen.getByRole('button', { name: 'Generate masks' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText('No model can describe the pictures. Add a Gemini or OpenAI key.')).toBeTruthy();
    fireEvent.click(button);
    expect(props.onGenerate).not.toHaveBeenCalled();
  });

  it('mask-generation R3 a running mask run lists Capturing views, Describing the materials, Painting the masks and Validating', () => {
    const { store } = setup();
    act(() => {
      store.getState().beginRun();
      store.getState().setStep('describe', 0.4);
    });
    for (const label of ['Capturing views', 'Describing the materials', 'Painting the masks', 'Validating']) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText('Enhancing prompt')).toBeNull();
    expect(screen.queryByText('Generating image')).toBeNull();
  });

  it('mask-generation R14 Cancel says it may still be billed once the image call has started', () => {
    const { store } = setup();
    act(() => {
      store.getState().beginRun();
      store.getState().setStep('generate', 0);
    });
    expect(screen.getByRole('button', { name: 'Cancel (may still be billed)' })).toBeTruthy();
  });

  it('mask-generation R2 going back to Albedo brings the albedo panel back', () => {
    setup();
    fireEvent.click(screen.getByRole('radio', { name: 'Albedo' }));
    expect(screen.getByText('Prompt')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeTruthy();
  });
});
