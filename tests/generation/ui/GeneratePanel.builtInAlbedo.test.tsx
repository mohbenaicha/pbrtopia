// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findKnownModel } from '../../../src/generation/catalog/knownModels';
import { createGenerateStore } from '../../../src/generation/generateStore';
import { createRunLogStore } from '../../../src/generation/runLogStore';
import { GeneratePanel } from '../../../src/generation/ui/GeneratePanel';
import { describeTooltipOf } from '../../support/tooltipDescription';

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

type InForce = { kind: 'picture'; id: string } | { kind: 'model'; key: string } | { kind: 'mixed' } | { kind: 'none' };

function setup(albedoInForce: InForce) {
  const store = createGenerateStore();
  const s = store.getState();
  s.setMaxTextureSize(8192);
  s.setCatalog({ gemini: [known('gemini', 'gemini-nano-banana-2.1'), known('gemini', 'gemini-3.8-flash')], openai: [], openrouter: [] });
  s.setHasKey('gemini', true);
  s.setSceneState({ hasModel: true, hasUvs: true, albedoInForce, sourceIsSquare: true });
  s.selectModel('gemini', 'gemini-nano-banana-2.1');
  const props = { onGenerate: vi.fn(), onGenerateUv: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onPreviewAtlas: vi.fn(async () => ({ ok: true as const, value: new Blob(['atlas']) })) };
  render(<GeneratePanel projectId="p1" store={store} logStore={createRunLogStore()} today="2026-10-19" {...props} />);
  return { store, props };
}

describe('the channel gate counts the model\'s own albedo (normal-map R2, textures R24)', () => {
  it('normal-map R2 a model that shows only its own albedo enables Normal and Metal-Roughness, with no bake needed', () => {
    setup({ kind: 'model', key: 'tex-0' });
    for (const name of ['Albedo', 'Normal', 'Metal-Roughness']) expect((screen.getByRole('radio', { name }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('normal-map R2 a generated picture on every material still enables them', () => {
    setup({ kind: 'picture', id: 'a' });
    for (const name of ['Normal', 'Metal-Roughness']) expect((screen.getByRole('radio', { name }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('normal-map R2 different images on the materials (mixed) or none disable both with the unchanged reason', () => {
    for (const albedoInForce of [{ kind: 'mixed' }, { kind: 'none' }] as const) {
      setup(albedoInForce);
      for (const name of ['Normal', 'Metal-Roughness']) {
        const radio = screen.getByRole('radio', { name }) as HTMLButtonElement;
        expect(radio.disabled).toBe(true);
        expect(describeTooltipOf(radio)).toContain('Bake or apply one albedo to the whole model first.');
      }
      expect((screen.getByRole('radio', { name: 'Albedo' }) as HTMLButtonElement).disabled).toBe(false);
      cleanup();
    }
  });
});

describe('Replace current masks (mask-mode R25, mask-generation R2)', () => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Additional settings' }));

  it('mask-mode R25 Metal-Roughness shows the Replace current masks switch under Additional settings, off by default, with its tooltip', () => {
    const { store } = setup({ kind: 'model', key: 'tex-0' });
    fireEvent.click(screen.getByRole('radio', { name: 'Metal-Roughness' }));
    open();
    const toggle = screen.getByRole('switch', { name: 'Replace current masks' });
    expect(toggle).toHaveProperty('ariaChecked', 'false');
    expect(describeTooltipOf(toggle)).toContain('Off: Bake masks adds this run\'s materials to the current masks. On: Bake masks replaces the current masks.');
    expect(store.getState().replaceCurrentMasks).toBe(false);
  });

  it('mask-mode R25 pressing it sets the store flag that the mask run writes into the plan, and a second press clears it', () => {
    const { store } = setup({ kind: 'model', key: 'tex-0' });
    fireEvent.click(screen.getByRole('radio', { name: 'Metal-Roughness' }));
    open();
    fireEvent.click(screen.getByRole('switch', { name: 'Replace current masks' }));
    expect(store.getState().replaceCurrentMasks).toBe(true);
    fireEvent.click(screen.getByRole('switch', { name: 'Replace current masks' }));
    expect(store.getState().replaceCurrentMasks).toBe(false);
  });

  it('mask-mode R25 it is there in Custom as well and not for the Albedo or Normal channels', () => {
    const { store } = setup({ kind: 'model', key: 'tex-0' });
    open();
    expect(screen.queryByRole('switch', { name: 'Replace current masks' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Metal-Roughness' }));
    act(() => store.getState().setMode('custom'));
    expect(screen.getByRole('switch', { name: 'Replace current masks' })).toBeTruthy();
  });
});
