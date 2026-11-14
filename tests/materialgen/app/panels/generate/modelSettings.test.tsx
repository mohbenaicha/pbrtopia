// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GenerationPlan } from '@mat/generation';
import { ModelSettingsSection } from '@mat/app/panels/generate/ModelSettingsSection';
import { describeTooltipOf } from '../../../../support/tooltipDescription';
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

  it('R1 the Preset select lists the three Full material presets and Single map, and choosing one hands its value over', () => {
    const generation = renderSection();
    fireEvent.click(screen.getByRole('combobox', { name: 'Preset' }));
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Full material: Gemini', 'Full material: GPT Image', 'Full material: Gemini + GPT Image', 'Single map']);
    for (const option of options) expect(describeTooltipOf(option).length).toBeGreaterThan(10); // each says what it is about on hover
    fireEvent.click(screen.getByRole('option', { name: 'Full material: Gemini + GPT Image' }));
    expect(generation.choice.choose).toHaveBeenCalledWith('preset-3');
  });

  describe('R2 R4 app R14a Single map: the tabs pick the map to generate', () => {
    const singleMap = (maps: 'albedo' | 'normal' | 'height' | 'metal-roughness') => {
      const base = makeGenerationPanel({ presetId: 'single-map', keyed: ['openai'] });
      const settings = base.choice.plan.images[0]!.settings;
      const plan: GenerationPlan = maps === 'metal-roughness' ? { images: [], decomposition: settings } : { images: [{ maps: [maps], settings }], decomposition: null };
      return makeGenerationPanel({ presetId: 'single-map', keyed: ['openai'], plan });
    };

    it('shows the four tabs, the plan\'s map selected, one settings group, and no Metal-Roughness switch', () => {
      renderSection(singleMap('normal'));
      expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('aria-label') ?? radio.textContent)).toEqual(['Albedo', 'Normal', 'Height', 'Metal-Roughness']);
      expect(screen.getByRole('radio', { name: 'Normal' }).getAttribute('aria-checked')).toBe('true');
      expect(screen.getAllByRole('region')).toHaveLength(1);
      expect(screen.getAllByRole('combobox').map((box) => document.getElementById(box.getAttribute('aria-labelledby')!)?.textContent)).toEqual(['Preset', 'Model', 'Resolution', 'Quality']);
      choose('Metal-Roughness');
      expect(screen.queryByRole('switch', { name: 'Generate metal and roughness' })).toBeNull(); // the tab is the choice
    });

    it('a tab makes the plan one map image holding that map, with the model, resolution and quality kept', () => {
      const generation = renderSection(singleMap('albedo'));
      choose('Height');
      expect(lastPlan(generation)).toEqual({ images: [{ maps: ['height'], settings: generation.choice.plan.images[0]!.settings }], decomposition: null });
    });

    it('Metal-Roughness makes the plan the Metal-Roughness card alone, and the tab shows when the plan is that card', () => {
      const generation = renderSection(singleMap('albedo'));
      choose('Metal-Roughness');
      expect(lastPlan(generation)).toEqual({ images: [], decomposition: generation.choice.plan.images[0]!.settings });
      cleanup();
      renderSection(singleMap('metal-roughness'));
      expect(screen.getByRole('radio', { name: 'Metal-Roughness' }).getAttribute('aria-checked')).toBe('true');
      expect(screen.getAllByRole('combobox', { name: 'Resolution' })).toHaveLength(1);
    });

    it('the model, resolution and quality are adjustable and change the one card', () => {
      const generation = renderSection(singleMap('normal'));
      fireEvent.click(screen.getByRole('combobox', { name: 'Resolution' }));
      fireEvent.click(screen.getAllByRole('option').find((option) => option.getAttribute('aria-selected') !== 'true')!);
      expect(lastPlan(generation).images[0]!.maps).toEqual(['normal']);
      expect(lastPlan(generation).images[0]!.settings.resolutionKey).not.toBe(generation.choice.plan.images[0]!.settings.resolutionKey);
    });
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
