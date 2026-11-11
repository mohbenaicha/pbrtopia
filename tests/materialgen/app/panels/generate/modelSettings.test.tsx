// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GenerationPlan } from '@mat/generation';
import { ModelSettingsSection } from '@mat/app/panels/generate/ModelSettingsSection';
import { makeGenerationPanel } from './fakeGeneration';

afterEach(cleanup);

const renderSection = (generation = makeGenerationPanel(), disabled = false) => {
  render(<ModelSettingsSection generation={generation} colorMode="albedo" disabled={disabled} />);
  return generation;
};
const lastPlan = (generation: ReturnType<typeof makeGenerationPanel>): GenerationPlan => vi.mocked(generation.choice.replacePlan).mock.calls.at(-1)![0];
const choose = (name: string): void => {
  fireEvent.click(screen.getByRole('radio', { name }));
};

describe('materialgen/generation Model settings', () => {
  it('R13 R15 the Preset comes first, then one toggle per card (each map image, then Metal-Roughness), and one settings group for the chosen card', () => {
    renderSection();
    expect(screen.getByRole('combobox', { name: 'Preset' })).toBeTruthy();
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('aria-label') ?? radio.textContent)).toEqual(['Albedo', 'Normal', 'Height', 'Metal-Roughness']);
    expect(screen.getAllByRole('region')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Albedo' })).toBeTruthy();
    expect(screen.queryByText(/^Image 1/)).toBeNull(); // no "Image 1: Albedo" line and no card name in the labels
    expect(screen.getAllByRole('combobox').map((box) => box.getAttribute('aria-labelledby') && document.getElementById(box.getAttribute('aria-labelledby')!)?.textContent)).toEqual(['Preset', 'Model', 'Resolution', 'Quality']);
  });

  it('R1 the Preset select lists the three presets and choosing one hands its value over', () => {
    const generation = renderSection();
    fireEvent.click(screen.getByRole('combobox', { name: 'Preset' }));
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Gemini', 'GPT Image', 'Gemini + GPT Image']);
    for (const option of options) expect((option.getAttribute('title') ?? '').length).toBeGreaterThan(10); // each says what it is about on hover
    fireEvent.click(screen.getByRole('option', { name: 'Gemini + GPT Image' }));
    expect(generation.choice.choose).toHaveBeenCalledWith('preset-3');
  });

  it('R15 the Metal-Roughness toggle shows its hint and its own fields', () => {
    renderSection();
    choose('Metal-Roughness');
    expect(screen.getByRole('switch', { name: 'Generate metal and roughness' })).toBeTruthy();
    expect(screen.getAllByRole('combobox', { name: 'Resolution' })).toHaveLength(1); // the Metal-Roughness card's, not Albedo's
  });

  it('R13 in the Diffuse colour mode the colour card is named Diffuse', () => {
    render(<ModelSettingsSection generation={makeGenerationPanel()} colorMode="diffuse" disabled={false} />);
    expect(screen.getByRole('radio', { name: 'Diffuse' })).toBeTruthy();
  });

  it('R16 changing the resolution of one card replaces the plan with only that card changed', () => {
    const generation = renderSection();
    choose('Normal');
    const card = screen.getByRole('region', { name: 'Normal' });
    fireEvent.click(within(card).getByRole('combobox', { name: 'Resolution' }));
    const options = screen.getAllByRole('option');
    const target = options.find((option) => option.getAttribute('aria-selected') !== 'true')!;
    fireEvent.click(target);
    const next = lastPlan(generation);
    expect(next.images[1]!.settings.resolutionKey).not.toBe(generation.choice.plan.images[1]!.settings.resolutionKey);
    expect(next.images[0]).toEqual(generation.choice.plan.images[0]);
    expect(next.images[2]).toEqual(generation.choice.plan.images[2]);
  });

  it('R67 a card whose provider has no key shows its own problem', () => {
    renderSection(makeGenerationPanel({ presetId: 'preset-3', keyed: ['gemini'] }));
    expect(screen.queryByRole('alert')).toBeNull(); // Image 1 is Gemini
    choose('Normal');
    expect(within(screen.getByRole('region', { name: 'Normal' })).getByRole('alert').textContent).toBe('Add your OpenAI key in Settings > Keys');
  });

  it('R15 switching the Metal-Roughness switch off removes the card from the plan', () => {
    const generation = renderSection();
    choose('Metal-Roughness');
    fireEvent.click(screen.getByRole('switch', { name: 'Generate metal and roughness' }));
    expect(lastPlan(generation).decomposition).toBeNull();
  });

  it('R15 a plan without the card shows the switch off and no fields, and switching it on adds the card with settings of the lead model', () => {
    const base = makeGenerationPanel();
    const withoutCard = { ...base, choice: { ...base.choice, plan: { ...base.choice.plan, decomposition: null } }, report: { ...base.report, cards: base.report.cards.filter((card) => card.card !== 'decomposition') } };
    renderSection(withoutCard);
    choose('Metal-Roughness');
    const box = screen.getByRole('switch', { name: 'Generate metal and roughness' }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(screen.queryByRole('combobox', { name: 'Metal-Roughness resolution' })).toBeNull();
    fireEvent.click(box);
    expect(lastPlan(withoutCard).decomposition).toMatchObject({ provider: 'gemini' });
  });

  it('R10 while a run goes or the project is read-only the Preset, the fields and the switch are disabled', () => {
    renderSection(makeGenerationPanel(), true);
    expect(screen.getByRole('combobox', { name: 'Preset' }).matches(':disabled')).toBe(true);
    expect(screen.getByRole('combobox', { name: 'Resolution' }).matches(':disabled')).toBe(true); // a disabled fieldset disables the controls inside it
    choose('Metal-Roughness');
    expect(screen.getByRole('switch', { name: 'Generate metal and roughness' }).matches(':disabled')).toBe(true);
  });
});
