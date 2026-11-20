// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findKnownModel } from '../../../src/generation/catalog/knownModels';
import { createGenerateStore } from '../../../src/generation/generateStore';
import { createRunLogStore } from '../../../src/generation/runLogStore';
import { GeneratePanel } from '../../../src/generation/ui/GeneratePanel';
import { openTooltipTextOf } from '../../support/tooltipDescription';

beforeEach(() => {
  let count = 0;
  URL.createObjectURL = vi.fn(() => `blob:fake/${++count}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const settings = { provider: 'gemini' as const, modelId: 'gemini-nano-banana-2.1', resolutionKey: '1K' as const, quality: null };

function setup(withSetUp = true, setupLocked = false) {
  const store = createGenerateStore();
  const s = store.getState();
  s.setMaxTextureSize(8192);
  const model = (id: string) => findKnownModel('gemini', id) ?? (() => { throw new Error(id); })();
  s.setCatalog({ gemini: [model('gemini-nano-banana-2.1'), model('gemini-3.8-flash')], openai: [], openrouter: [] });
  s.setHasKey('gemini', true);
  s.setSceneState({ hasModel: true, hasUvs: true });
  s.selectModel('gemini', 'gemini-nano-banana-2.1');
  const props = { onGenerate: vi.fn(), onSetUpCustom: vi.fn() };
  render(
    <GeneratePanel
      projectId="p1"
      store={store}
      logStore={createRunLogStore()}
      readImageFile={vi.fn()}
      today="2026-10-19"
      onGenerateUv={vi.fn()}
      onCancel={vi.fn()}
      onRetry={vi.fn()}
      onPreviewAtlas={vi.fn()}
      onGenerate={props.onGenerate}
      {...(withSetUp ? { onSetUpCustom: props.onSetUpCustom } : {})}
      {...(setupLocked ? { setupLocked } : {})}
    />,
  );
  return { store, ...props };
}

const isInert = (element: HTMLElement): boolean => element.closest('[inert]') !== null;

describe('GeneratePanel: while the setup overlay is open (custom R30)', () => {
  it('custom R30 the tabs, Prompt, references, channel, Generate and the Custom setup gear are inert', () => {
    setup(true, true);
    for (const element of [
      screen.getByRole('tab', { name: 'Generate' }),
      screen.getByRole('tab', { name: 'Debug' }),
      screen.getByRole('textbox', { name: 'Prompt' }),
      screen.getByRole('button', { name: 'Custom setup' }),
      screen.getByRole('button', { name: /^Generate/ }),
      screen.getByRole('combobox', { name: /model/i }),
    ]) expect(isInert(element), element.outerHTML.slice(0, 60)).toBe(true);
  });

  it('custom R30 Additional settings stays live: its toggle, the atlas render and the tile borders', () => {
    setup(true, true);
    const toggle = screen.getByRole('button', { name: 'Additional settings' });
    expect(isInert(toggle)).toBe(false);
    fireEvent.click(toggle);
    expect(isInert(screen.getByRole('combobox', { name: 'Atlas render' }))).toBe(false);
    expect(isInert(screen.getByRole('checkbox', { name: 'Tile borders' }))).toBe(false);
  });

  it('custom R30 with the overlay closed nothing in the panel is inert', () => {
    setup(true, false);
    expect(document.querySelector('[inert]')).toBeNull();
  });
});

describe('GeneratePanel: custom mode (custom R1)', () => {
  it('custom R1 there is no Custom switch; the tab starts in Standard', () => {
    const { store } = setup();
    expect(screen.queryByRole('switch', { name: 'Custom' })).toBeNull();
    expect(store.getState().mode).toBe('standard');
    expect(screen.getByRole('button', { name: 'Generate' })).toBeTruthy();
  });

  it('custom R1 in Custom mode the model, resolution and quality fields give way and prompt, references, channel and Additional settings stay', () => {
    const { store } = setup();
    act(() => store.getState().setMode('custom'));
    for (const name of ['Model', 'Resolution', 'Quality']) expect(screen.queryByRole('combobox', { name })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Prompt' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Channel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Additional settings' })).toBeTruthy();
  });

  it('custom R12 Custom hides Atlas size and the atlas preview, keeps Atlas render and Tile borders, and Standard shows them all', () => {
    const { store } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Additional settings' }));
    const names = () => ({
      size: screen.queryByRole('combobox', { name: 'Atlas size' }),
      preview: screen.queryByRole('button', { name: 'Preview atlas' }),
      render: screen.queryByRole('combobox', { name: 'Atlas render' }),
      borders: screen.queryByRole('checkbox', { name: 'Tile borders' }),
    });
    expect(Object.values(names()).every((el) => el !== null)).toBe(true);
    act(() => store.getState().setMode('custom'));
    const custom = names();
    expect(custom.size).toBeNull();
    expect(custom.preview).toBeNull();
    expect(custom.render).not.toBeNull();
    expect(custom.borders).not.toBeNull();
  });

  it('custom R1 going back to Standard brings the fields back', () => {
    const { store } = setup();
    act(() => store.getState().setMode('custom'));
    act(() => store.getState().setMode('standard'));
    for (const name of ['Model', 'Resolution', 'Quality']) expect(screen.getByRole('combobox', { name })).toBeTruthy();
  });

  it('custom R1 Standard is the default; the gear "Custom setup" switches to Custom and opens the setup', () => {
    const { onSetUpCustom, store } = setup();
    expect(store.getState().mode).toBe('standard');
    fireEvent.click(screen.getByRole('button', { name: 'Custom setup' }));
    expect(onSetUpCustom).toHaveBeenCalledTimes(1);
    expect(store.getState().mode).toBe('custom');
    expect(screen.queryByRole('button', { name: 'Edit setup' })).toBeNull();
  });

  it('custom R1 the gear sits on the Generate button\'s row, after it, and is disabled while a run is going', () => {
    const { store } = setup();
    const gear = screen.getByRole('button', { name: 'Custom setup' });
    const generate = screen.getByRole('button', { name: /^Generate/ });
    expect(gear.closest('.generate-panel__actions')).not.toBeNull();
    expect(generate.closest('.generate-panel__actions')).toBe(gear.closest('.generate-panel__actions'));
    expect(generate.compareDocumentPosition(gear) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((gear as HTMLButtonElement).disabled).toBe(false);
    act(() => store.setState({ status: 'running', step: null }));
    expect((screen.getByRole('button', { name: 'Custom setup' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('custom R1 with no plan confirmed Generate is disabled with "Set up the custom generation first."', () => {
    const { store } = setup();
    act(() => store.getState().setMode('custom'));
    expect((screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Set up the custom generation first.')).toBeTruthy();
  });

  it('custom R1 an empty plan says "Assign at least one camera to an image."', () => {
    const { store } = setup();
    act(() => {
      store.getState().setMode('custom');
      store.getState().confirmCustomPlan({ sheets: [{ cameras: [], settings }], aux: null });
    });
    expect(screen.getByText('Assign at least one camera to an image.')).toBeTruthy();
  });

  it('custom R1 a valid plan makes the button Generate (custom) with the image count as its tooltip, and clicking runs', () => {
    const { store, onGenerate } = setup();
    act(() => {
      store.getState().setMode('custom');
      store.getState().confirmCustomPlan({ sheets: [{ cameras: [0], settings }, { cameras: [1, 2], settings }], aux: { settings } });
    });
    const button = screen.getByRole('button', { name: 'Generate (custom)' });
    expect(openTooltipTextOf(button)).toBe('Generate (custom). 3 images');
    fireEvent.click(button);
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('custom R28 a plan whose model is gone from the list is unavailable and says so', () => {
    const { store } = setup();
    act(() => {
      store.getState().setMode('custom');
      store.getState().confirmCustomPlan({ sheets: [{ cameras: [0], settings: { ...settings, modelId: 'gone-model' } }], aux: null });
    });
    expect((screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/no longer available/)).toBeTruthy();
  });

  it('custom R1 the gear cannot be used while a run is going', () => {
    const { store } = setup();
    act(() => store.getState().beginRun());
    expect((screen.getByRole('button', { name: 'Custom setup' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
