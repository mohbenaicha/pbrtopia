// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findKnownModel } from '../../../src/generation/catalog/knownModels';
import type { ProviderModelRecord } from '../../../src/generation/catalog/modelTypes';
import { createGenerateStore, type ReferenceImage } from '../../../src/generation/generateStore';
import { createRunLogStore } from '../../../src/generation/runLogStore';
import { GeneratePanel } from '../../../src/generation/ui/GeneratePanel';

const known = (provider: 'gemini' | 'openai', id: string): ProviderModelRecord => {
  const entry = findKnownModel(provider, id);
  if (entry === null) throw new Error(`${id} is not in the table`);
  return entry;
};
const unverified: ProviderModelRecord = { provider: 'openai', id: 'gpt-image-9-mystery', role: 'image', displayName: 'gpt-image-9-mystery', verified: false, resolutions: [], qualityLevels: [] };

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:fake/1');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

function setup(prepare: (store: ReturnType<typeof createGenerateStore>) => void = () => undefined) {
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
  const props = { onGenerate: vi.fn(), onGenerateUv: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn() };
  const readImageFile = vi.fn(async (file: File): Promise<ReferenceImage> => ({ id: `${file.name}:${file.size}`, name: file.name, width: 8, height: 8, blob: file }));
  const view = render(<GeneratePanel projectId="p1" store={store} logStore={createRunLogStore()} readImageFile={readImageFile} today="2026-10-19" {...props} />);
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
  it('R1 shows prompt, references, channel, model, resolution, quality and Generate', () => {
    setup();
    expect(screen.getByRole('textbox', { name: 'Prompt' })).toBeTruthy();
    expect(screen.getByLabelText('Add reference images')).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Channel' })).toBeTruthy();
    for (const name of ['Model', 'Resolution', 'Atlas size', 'Quality']) expect(screen.getByRole('combobox', { name })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeTruthy();
  });

  it('R1 typing in the prompt writes the store', () => {
    const { store } = setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), { target: { value: 'weathered bronze' } });
    expect(store.getState().prompt).toBe('weathered bronze');
  });

  it('R2 image files dropped on the prompt field are added as references like chosen files', async () => {
    const { store, readImageFile } = setup();
    const file = new File(['x'], 'drop.png', { type: 'image/png' });
    fireEvent.drop(screen.getByRole('textbox', { name: 'Prompt' }), { dataTransfer: { files: [file], types: ['Files'] } });
    await waitFor(() => expect(store.getState().references.map((reference) => reference.name)).toEqual(['drop.png']));
    expect(readImageFile).toHaveBeenCalledTimes(1);
  });

  it('R2 a drop with no file is left to the field, and files dragged over show that the field accepts them', () => {
    setup();
    const prompt = screen.getByRole('textbox', { name: 'Prompt' });
    const textDrop = fireEvent.drop(prompt, { dataTransfer: { files: [], types: ['text/plain'] } });
    expect(textDrop).toBe(true); // not default-prevented
    fireEvent.dragEnter(prompt, { dataTransfer: { files: [], types: ['Files'] } });
    expect(prompt.hasAttribute('data-drop-target')).toBe(true);
    fireEvent.dragLeave(prompt, { dataTransfer: { files: [], types: ['Files'] } });
    expect(prompt.hasAttribute('data-drop-target')).toBe(false);
  });

  it('R1 the panel has no debug button (the debug view is the mode toolbar\'s switch)', () => {
    setup();
    expect(screen.queryByRole('button', { name: /debug/i })).toBeNull();
  });

  it('R19 a notice from the store is shown as plain status text, with no Retry', () => {
    setup((store) => store.getState().setNotice('The set is saved. Open it from the Projections tab.'));
    expect(screen.getByRole('status').textContent).toBe('The set is saved. Open it from the Projections tab.');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('R19 nothing is shown when there is no notice', () => {
    setup();
    expect(screen.queryByRole('status')).toBeNull();
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

  it('R16 the Atlas size dropdown lists 1K, 2K and 4K, starts at 2K and sets only the atlas key in the store', () => {
    const { store, combo, optionsOf } = setup();
    expect(optionsOf('Atlas size').map((label) => label.split(' ')[0])).toEqual(['1K', '2K', '4K']);
    expect(combo('Atlas size').textContent).toMatch(/2K/);
    fireEvent.click(combo('Atlas size'));
    fireEvent.click(screen.getByRole('option', { name: /^1K/ }));
    expect(store.getState()).toMatchObject({ atlasKey: '1K', resolutionKey: '2K' });
    expect(combo('Resolution').textContent).toMatch(/2K/);
  });

  it('R16 the Atlas size dropdown does not follow the model: Flash Lite (output 1K only) keeps the 2K atlas', () => {
    const { combo } = setup((store) => store.getState().selectModel('gemini', 'gemini-3.1-flash-lite-image'));
    expect(combo('Atlas size').textContent).toMatch(/2K/);
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

  it('G6 warns once about table rows older than 90 days on mount in a development build, and not again on re-render', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const store = createGenerateStore();
      const panel = <GeneratePanel projectId="p1" store={store} logStore={createRunLogStore()} readImageFile={vi.fn()} today="2099-01-01" onGenerate={vi.fn()} onGenerateUv={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} />;
      const { rerender } = render(panel);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toMatch(/Known models last checked/);
      act(() => store.getState().setPrompt('x'));
      rerender(panel);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('G6 does not warn in a production build', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('DEV', false);
    try {
      render(<GeneratePanel projectId="p1" store={createGenerateStore()} logStore={createRunLogStore()} readImageFile={vi.fn()} today="2099-01-01" onGenerate={vi.fn()} onGenerateUv={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} />);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
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

  it('R2 the refusal sentence follows the model chosen when the files finish reading, not when they were picked', async () => {
    const { store, readImageFile } = setup((s) => {
      s.getState().setHasKey('openai', true);
      s.getState().selectModel('openai', 'gpt-image-2.5-sunburst'); // no cap in the table
    });
    let finish: (images: ReferenceImage[]) => void = () => undefined;
    const reads = new Promise<ReferenceImage[]>((resolve) => {
      finish = resolve;
    });
    readImageFile.mockImplementation(async (picked: File) => (await reads).find((image) => image.name === picked.name) as ReferenceImage);
    const files = Array.from({ length: 15 }, (_, i) => file(`r${i}.png`, i + 1));
    fireEvent.change(screen.getByLabelText('Add reference images'), { target: { files } });
    act(() => store.getState().selectModel('gemini', 'gemini-nano-banana-2.1')); // now 14 in total
    finish(files.map((f) => ({ id: f.name, name: f.name, width: 8, height: 8, blob: f })));
    await waitFor(() => expect(store.getState().references).toHaveLength(13));
    expect(screen.getByRole('status').textContent).toMatch(/at most 14 images in total.*up to 13 references/);
  });

  it('R2 files that finish reading after the panel is gone are dropped', async () => {
    const { store, readImageFile, unmount } = setup();
    let finish: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    readImageFile.mockImplementation(async (picked: File) => {
      await gate;
      return { id: picked.name, name: picked.name, width: 8, height: 8, blob: picked };
    });
    fireEvent.change(screen.getByLabelText('Add reference images'), { target: { files: [file('late.png')] } });
    unmount();
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getState().references).toHaveLength(0);
  });

  it('R2 the refusal notice goes away when the model changes', async () => {
    const { store } = setup();
    await addFiles(Array.from({ length: 15 }, (_, i) => file(`r${i}.png`, i + 1)));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    act(() => store.getState().selectModel('gemini', 'gemini-3-pro-image'));
    expect(screen.queryByRole('status')).toBeNull();
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

  it('R6 while a request is in flight with no step list (the unwrap) the button is disabled with its reason', () => {
    setup((store) => store.setState({ status: 'running' }));
    expect((screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/already running/)).toBeTruthy();
  });

  it('R15 a model with no UVs shows Generate UV instead of Generate; the click opens the options dialog and calls nothing yet', () => {
    const { props } = setup((store) => store.getState().setSceneState({ hasModel: true, hasUvs: false }));
    expect(screen.queryByRole('button', { name: 'Generate' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Generate UV' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(props.onGenerateUv).not.toHaveBeenCalled();
    expect(props.onGenerate).not.toHaveBeenCalled();
  });

  it('R15 confirming the dialog calls onGenerateUv once with the chosen options and closes it', () => {
    const { props } = setup((store) => store.getState().setSceneState({ hasModel: true, hasUvs: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate UV' }));
    fireEvent.change(screen.getByLabelText('Padding (texels)'), { target: { value: '6' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Generate UV' }));
    expect(props.onGenerateUv).toHaveBeenCalledTimes(1);
    expect(props.onGenerateUv).toHaveBeenCalledWith({ resolution: 2048, paddingTexels: 6 });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('R15 cancelling the dialog calls nothing', () => {
    const { props } = setup((store) => store.getState().setSceneState({ hasModel: true, hasUvs: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate UV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(props.onGenerateUv).not.toHaveBeenCalled();
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
