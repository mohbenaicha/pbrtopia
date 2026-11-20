// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProviderModelRecord } from '../../../src/generation/catalog/modelTypes';
import type { ModelCatalog } from '../../../src/generation/generateStore';
import { ModelSelect } from '../../../src/generation/ui/ModelSelect';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function model(provider: ProviderModelRecord['provider'], id: string, displayName: string, extra: Partial<ProviderModelRecord> = {}): ProviderModelRecord {
  return { provider, id, role: 'image', displayName, verified: true, resolutions: [], qualityLevels: [], ...extra };
}

const CATALOG: ModelCatalog = {
  gemini: [model('gemini', 'g-image', 'Nano Image'), model('gemini', 'g-text', 'Gemini Text', { role: 'vision-text' })],
  openai: [model('openai', 'o-new', 'Zed Image', { verified: false }), model('openai', 'o-image', 'GPT Image')],
  openrouter: [],
};

function setup(props: Partial<React.ComponentProps<typeof ModelSelect>> = {}) {
  const onSelect = vi.fn();
  const view = render(<ModelSelect catalog={CATALOG} hasKey={{ gemini: true, openai: true, openrouter: false }} provider={null} modelId={null} today="2000-01-01" onSelect={onSelect} {...props} />);
  return { onSelect, user: userEvent.setup(), ...view };
}

describe('ModelSelect (R4)', () => {
  it('R4 lists the image models of providers that have a key as "Provider: name", sorted, and marks an unknown model unverified', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('combobox', { name: 'Model' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Gemini: Nano Image', 'OpenAI: GPT Image', 'OpenAI: Zed Image (unverified)']);
  });

  it('R4 verified models sit under a heading per provider, and the unverified one is last under a separator with no heading', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('combobox', { name: 'Model' }));
    expect(screen.getAllByText(/^(Google|OpenAI)$/).map((heading) => heading.textContent)).toEqual(['Google', 'OpenAI']);
    expect(screen.getAllByRole('separator')).toHaveLength(1);
    const items = [...screen.getByRole('listbox').children].map((node) => node.getAttribute('role') + ':' + node.textContent);
    expect(items.at(-2)).toBe('separator:');
    expect(items.at(-1)).toBe('option:OpenAI: Zed Image (unverified)');
  });

  it('R4 a deprecated model is listed but cannot be chosen', async () => {
    const catalog: ModelCatalog = { gemini: [], openai: [model('openai', 'o-old', 'Old Image', { deprecated: true }), model('openai', 'o-image', 'GPT Image')], openrouter: [] };
    const { user, onSelect } = setup({ catalog });
    await user.click(screen.getByRole('combobox', { name: 'Model' }));
    const old = screen.getByRole('option', { name: 'OpenAI: Old Image (deprecated)' });
    expect(old.getAttribute('aria-disabled')).toBe('true');
    await user.click(old);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('R4 a provider without a key lists no models', async () => {
    const { user } = setup({ hasKey: { gemini: false, openai: true, openrouter: false } });
    await user.click(screen.getByRole('combobox', { name: 'Model' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['OpenAI: GPT Image', 'OpenAI: Zed Image (unverified)']);
  });

  it('R4 with no key at all the box is disabled and tells the user to add one in Settings', () => {
    setup({ hasKey: { gemini: false, openai: false, openrouter: false } });
    const box = screen.getByRole('combobox', { name: 'Model' }) as HTMLButtonElement;
    expect(box.disabled).toBe(true);
    expect(box.textContent).toContain('Add a key in Settings to list models');
  });

  it('R4 choosing a model reports its provider and id, even when the id contains a colon', async () => {
    const catalog: ModelCatalog = { gemini: [model('gemini', 'models/g:image', 'Colon Image')], openai: [], openrouter: [] };
    const { user, onSelect } = setup({ catalog });
    await user.click(screen.getByRole('combobox', { name: 'Model' }));
    await user.click(screen.getByRole('option', { name: 'Gemini: Colon Image' }));
    expect(onSelect).toHaveBeenCalledWith('gemini', 'models/g:image');
  });

  it('R4 the chosen model is shown in the closed box', () => {
    setup({ provider: 'openai', modelId: 'o-image' });
    expect(screen.getByRole('combobox', { name: 'Model' }).textContent).toContain('OpenAI: GPT Image');
  });

  it('R4 a table last checked long before today is reported once when the picker first appears, not on later renders', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { rerender, onSelect } = setup({ today: '2099-01-01' });
    expect(warn).toHaveBeenCalledTimes(1);
    rerender(<ModelSelect catalog={CATALOG} hasKey={{ gemini: true, openai: true, openrouter: false }} provider="gemini" modelId="g-image" today="2099-01-01" onSelect={onSelect} />);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('R4 a table checked recently reports nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setup({ today: '2000-01-01' });
    expect(warn).not.toHaveBeenCalled();
  });
});
