// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findKnownModel } from '../../../src/generation/catalog/knownModels';
import type { ModelInfo } from '../../../src/generation/catalog/modelTypes';
import { createGenerateStore, type ReferenceImage } from '../../../src/generation/generateStore';
import { GeneratePanel } from '../../../src/generation/ui/GeneratePanel';

const known = (provider: 'gemini' | 'openai', id: string): ModelInfo => {
  const entry = findKnownModel(provider, id);
  if (entry === null) throw new Error(`${id} is not in the table`);
  return entry;
};
const unverified: ModelInfo = { provider: 'openai', id: 'gpt-image-9-mystery', role: 'image', displayName: 'gpt-image-9-mystery', verified: false, resolutions: [], qualityLevels: [] };

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:fake/1');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

function setup(prepare: (store: ReturnType<typeof createGenerateStore>) => void = () => undefined, extra: { debugDisabled?: boolean } = {}) {
  const store = createGenerateStore();
  const s = store.getState();
  s.setMaxTextureSize(8192);
  s.setCatalog({
    gemini: [known('gemini', 'gemini-nano-banana-2.1'), known('gemini', 'gemini-3-pro-image'), known('gemini', 'gemini-3.8-flash')],
    openai: [known('openai', 'gpt-image-2.5-sunburst'), unverified, known('openai', 'gpt-6-astra')],
  });
  s.setHasKey('gemini', true);
  s.setSceneState({ hasModel: true, hasUvs: true });
  s.selectModel('gemini', 'gemini-nano-banana-2.1');
  prepare(store);
  const props = { onGenerate: vi.fn(), onGenerateUv: vi.fn(), onDebugProjection: vi.fn() };
  const readImageFile = vi.fn(async (file: File): Promise<ReferenceImage> => ({ id: `${file.name}:${file.size}`, name: file.name, width: 8, height: 8, blob: file }));
  const view = render(<GeneratePanel store={store} readImageFile={readImageFile} today="2026-10-19" {...props} {...extra} />);
  const combo = (name: string): HTMLElement => screen.getByRole('combobox', { name });
  const optionsOf = (name: string): string[] => {
    fireEvent.click(combo(name));
    const labels = within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent ?? '');
    fireEvent.click(combo(name)); // close
    return labels;
  };
  return { store, props, readImageFile, combo, optionsOf, ...view };
}

describe('GeneratePanel: fields (R1, R3)', () => {
  it('R1 shows prompt, references, channel, model, resolution, quality, Generate and the debug button', () => {
    setup();
    expect(screen.getByRole('textbox', { name: 'Prompt' })).toBeTruthy();
    expect(screen.getByLabelText('Add reference images')).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Channel' })).toBeTruthy();
    for (const name of ['Model', 'Resolution', 'Quality']) expect(screen.getByRole('combobox', { name })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Debug projection' })).toBeTruthy();
  });

  it('R1 typing in the prompt writes the store', () => {
    const { store } = setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), { target: { value: 'weathered bronze' } });
    expect(store.getState().prompt).toBe('weathered bronze');
  });

  it('R1 the debug button calls its handler and can be disabled', () => {
    const first = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Debug projection' }));
    expect(first.props.onDebugProjection).toHaveBeenCalledTimes(1);
    cleanup();
    setup(() => undefined, { debugDisabled: true });
    expect((screen.getByRole('button', { name: 'Debug projection' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('R3 Albedo is selected and the other channels are disabled', () => {
    setup();
    const group = screen.getByRole('radiogroup', { name: 'Channel' });
    const radios = within(group).getAllByRole('radio') as HTMLButtonElement[];
    expect(radios[0]?.textContent).toBe('Albedo');
    expect(radios[0]?.getAttribute('aria-checked')).toBe('true');
    expect(radios.slice(1).length).toBeGreaterThan(0);
    for (const radio of radios.slice(1)) expect(radio.disabled).toBe(true);
  });
});

describe('GeneratePanel: model, resolution, quality (R4, R5)', () => {
  it('R4 lists the image models of the providers that have a key, written Provider: name', () => {
    const { optionsOf } = setup();
    expect(optionsOf('Model')).toEqual(['Gemini: Gemini 3 Pro Image', 'Gemini: Nano Banana 2.1']);
  });

  it('R4 adds the models of a second provider once its key exists, unverified ones marked', () => {
    const { optionsOf } = setup((store) => store.getState().setHasKey('openai', true));
    const labels = optionsOf('Model');
    expect(labels).toContain('OpenAI: GPT Image 2.5 Sunburst');
    expect(labels).toContain('OpenAI: gpt-image-9-mystery (unverified)');
    expect(labels.some((label) => label.includes('gpt-6-astra'))).toBe(false);
  });

  it('R4 choosing a model sets the store and the resolution control follows', () => {
    const { store, combo } = setup((s) => s.getState().setHasKey('openai', true));
    fireEvent.click(combo('Model'));
    fireEvent.click(screen.getByRole('option', { name: 'OpenAI: GPT Image 2.5 Sunburst' }));
    expect(store.getState()).toMatchObject({ provider: 'openai', modelId: 'gpt-image-2.5-sunburst', resolutionKey: '2K' });
    expect(combo('Resolution').textContent).toMatch(/2K/);
  });

  it('R4 Gemini offers 1K, 2K and 4K and OpenAI offers 1K, 2K and 2.8K = 2880', () => {
    const gemini = setup();
    expect(gemini.optionsOf('Resolution').map((label) => label.split(' ')[0])).toEqual(['1K', '2K', '4K']);
    cleanup();
    const openai = setup((store) => {
      store.getState().setHasKey('openai', true);
      store.getState().selectModel('openai', 'gpt-image-2.5-sunburst');
    });
    const labels = openai.optionsOf('Resolution');
    expect(labels.map((label) => label.split(' ')[0])).toEqual(['1K', '2K', '2.8K']);
    expect(labels[2]).toMatch(/2880/);
  });

  it('R4 choosing a resolution sets the atlas size key in the store', () => {
    const { store, combo } = setup();
    fireEvent.click(combo('Resolution'));
    fireEvent.click(screen.getByRole('option', { name: /^4K/ }));
    expect(store.getState().resolutionKey).toBe('4K');
  });

  it('R5 the quality dropdown lists exactly the levels of the selected model', () => {
    const { optionsOf } = setup();
    expect(optionsOf('Quality')).toEqual(['minimal', 'medium', 'high']);
  });

  it('R5 the chosen level is the one stored, unchanged', () => {
    const { store, combo } = setup();
    fireEvent.click(combo('Quality'));
    fireEvent.click(screen.getByRole('option', { name: 'high' }));
    expect(store.getState().quality).toBe('high');
  });

  it('R5 a model with no levels offers none and the control is disabled', () => {
    const { combo } = setup((store) => store.getState().selectModel('gemini', 'gemini-3-pro-image'));
    expect((combo('Quality') as HTMLButtonElement).disabled).toBe(true);
  });

  it('R4 an unverified model offers no size and no level', () => {
    const { combo } = setup((store) => {
      store.getState().setHasKey('openai', true);
      store.getState().selectModel('openai', 'gpt-image-9-mystery');
    });
    expect((combo('Resolution') as HTMLButtonElement).disabled).toBe(true);
    expect((combo('Quality') as HTMLButtonElement).disabled).toBe(true);
  });

  it('R4 with no key for any provider the model list says what is missing', () => {
    const { combo } = setup((store) => {
      store.getState().setHasKey('gemini', false);
    });
    expect((combo('Model') as HTMLButtonElement).disabled).toBe(true);
    expect(combo('Model').textContent).toMatch(/key/i);
  });

  it('G6 warns about table rows older than 90 days once on mount in a development build, not again on re-render', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const store = createGenerateStore();
      const panel = <GeneratePanel store={store} readImageFile={vi.fn()} today="2099-01-01" onGenerate={vi.fn()} onGenerateUv={vi.fn()} onDebugProjection={vi.fn()} />;
      const { rerender } = render(panel);
      const afterMount = warn.mock.calls.length;
      expect(afterMount).toBeGreaterThan(0);
      act(() => store.getState().setPrompt('x'));
      rerender(panel);
      expect(warn.mock.calls.length).toBe(afterMount);
    } finally {
      warn.mockRestore();
    }
  });

  it('G6 says nothing when the table is fresh', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      setup();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe('GeneratePanel: references (R2)', () => {
  const file = (name: string, size = 1): File => new File([new Uint8Array(size)], name, { type: 'image/png' });
  const addFiles = async (files: File[]) => {
    fireEvent.change(screen.getByLabelText('Add reference images'), { target: { files } });
    await Promise.resolve();
  };

  it('R2 added files become thumbnails and removing one drops it', async () => {
    const { store } = setup();
    await addFiles([file('a.png'), file('b.png', 2)]);
    await waitFor(() => expect(store.getState().references).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Remove a.png' }));
    expect(store.getState().references.map((r) => r.name)).toEqual(['b.png']);
  });

  it('R2 more files than the model takes are refused and the strip says why', async () => {
    const { store } = setup();
    await addFiles(Array.from({ length: 15 }, (_, i) => file(`r${i}.png`, i + 1)));
    await waitFor(() => expect(store.getState().references).toHaveLength(13));
    expect(screen.getByRole('status').textContent).toMatch(/at most 14 images in total and one is the atlas, so up to 13 references/);
  });

  it('R2 a file that cannot be read as an image is skipped with a message and the others are kept', async () => {
    const { store, readImageFile } = setup();
    readImageFile.mockImplementationOnce(async () => {
      throw new Error('bad image');
    });
    await addFiles([file('bad.png'), file('ok.png', 2)]);
    await waitFor(() => expect(store.getState().references.map((r) => r.name)).toEqual(['ok.png']));
    expect(screen.getByRole('status').textContent).toMatch(/bad\.png/);
  });
});

describe('GeneratePanel: Generate button (R6, R15)', () => {
  it('R6 enabled Generate calls onGenerate once', () => {
    const { props } = setup((store) => store.getState().setEnhancer({ provider: 'gemini', modelId: 'gemini-3.8-flash' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(props.onGenerate).toHaveBeenCalledTimes(1);
  });

  it('R6 a disabled Generate shows its reason and does not call onGenerate', () => {
    const { props } = setup((store) => store.getState().setSceneState({ hasModel: false, hasUvs: false }));
    const button = screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/Load a 3D model/)).toBeTruthy();
    fireEvent.click(button);
    expect(props.onGenerate).not.toHaveBeenCalled();
  });

  it('R6 the reason follows the state: a missing key, then none once the key is added', () => {
    const { store } = setup((s) => s.getState().setHasKey('gemini', false));
    expect(screen.getByText(/Add a Gemini key/)).toBeTruthy();
    act(() => store.getState().setHasKey('gemini', true));
    expect(screen.queryByText(/Add a Gemini key/)).toBeNull();
  });

  it('R6 while a request is in flight the button is disabled with its reason', () => {
    setup((store) => store.getState().beginRun());
    expect((screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/already running/)).toBeTruthy();
  });

  it('R15 a model with no UVs shows Generate UV instead of Generate, and Generate UV calls onGenerateUv', () => {
    const { props } = setup((store) => store.getState().setSceneState({ hasModel: true, hasUvs: false }));
    expect(screen.queryByRole('button', { name: 'Generate' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Generate UV' }));
    expect(props.onGenerateUv).toHaveBeenCalledTimes(1);
    expect(props.onGenerate).not.toHaveBeenCalled();
  });

  it('R15 the other fields stay editable while the model has no UVs', () => {
    const { store } = setup((s) => s.getState().setSceneState({ hasModel: true, hasUvs: false }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), { target: { value: 'still editable' } });
    expect(store.getState().prompt).toBe('still editable');
  });

  it('R15 the button turns back into Generate when the model gets UVs', () => {
    const { store } = setup((s) => s.getState().setSceneState({ hasModel: true, hasUvs: false }));
    act(() => store.getState().setSceneState({ hasModel: true, hasUvs: true }));
    expect(screen.getByRole('button', { name: 'Generate' })).toBeTruthy();
  });
});
