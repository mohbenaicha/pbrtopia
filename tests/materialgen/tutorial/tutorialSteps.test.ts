import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTutorialText } from '@shared/tutorial';
import { TUTORIAL_SECTIONS } from '../../../src/materialgen/tutorial/tutorialSteps';

const TEXT = parseTutorialText(readFileSync('src/materialgen/tutorial/tutorial-text.md', 'utf8'));
const STEPS = TUTORIAL_SECTIONS.flatMap((section) => section.steps);

describe('the tutorial steps (tutorial R3, R9, R13)', () => {
  it('TestR3_the_sections_and_steps_are_in_the_spec_table_order', () => {
    expect(TUTORIAL_SECTIONS.map((section) => section.id)).toEqual(['generate', 'maps', 'viewport', 'masks', 'shading', 'topbar', 'export', 'projects', 'settings']);
    expect(STEPS.map((entry) => entry.id)).toEqual([
      'generate.prompt', 'generate.ideas', 'generate.references', 'generate.color', 'generate.size', 'generate.model', 'generate.button', 'generate.summary', 'generate.log',
      'maps.tools', 'maps.cards', 'maps.card-actions', 'maps.normal', 'maps.occlusion',
      'viewport.open', 'viewport.environment', 'viewport.material', 'viewport.preview-only',
      'masks.open', 'masks.swatches', 'masks.properties', 'shading.control', 'topbar.actions',
      'export.types', 'export.packing', 'export.parts', 'export.size',
      'projects.new', 'projects.import', 'projects.settings', 'projects.card',
      'settings.keys', 'settings.env', 'settings.models', 'settings.storage',
    ]);
  });

  it('TestR3_step_ids_and_anchors_are_unique_and_every_step_has_a_stage', () => {
    expect(new Set(STEPS.map((entry) => entry.id)).size).toBe(STEPS.length);
    expect(new Set(STEPS.map((entry) => entry.anchor)).size).toBe(STEPS.length);
    expect(STEPS.every((entry) => typeof entry.stage === 'string' && entry.stage !== '')).toBe(true);
  });

  it('TestR4_a_step_without_its_own_stage_runs_where_the_step_before_it_did', () => {
    const byId = Object.fromEntries(STEPS.map((entry) => [entry.id, entry.stage]));
    expect(byId['generate.ideas']).toBe('project');
    expect(byId['export.size']).toBe('project');
    expect(byId['projects.card']).toBe('list');
    expect(byId['settings.env']).toBe('settings:keys');
    expect(byId['settings.storage']).toBe('settings:storage');
  });

  it('TestR9_every_step_has_words_and_the_file_has_no_words_without_a_step', () => {
    expect(Object.keys(TEXT).sort()).toEqual(STEPS.map((entry) => entry.id).sort());
    for (const entry of STEPS) expect(TEXT[entry.id]?.paragraphs.length, entry.id).toBeGreaterThan(0);
  });

  it('TestR13_the_words_say_what_the_spec_requires_where_it_requires_it', () => {
    const words = (id: string): string => (TEXT[id]?.paragraphs ?? []).join(' ').toLowerCase();
    expect(words('viewport.preview-only')).toMatch(/never change .*export/);
    expect(words('masks.open')).toContain('metal-roughness');
    expect(words('maps.occlusion')).toMatch(/generate/);
    expect(words('maps.normal')).toMatch(/height map/);
    expect(words('maps.normal')).toMatch(/generate/);
    expect(words('maps.cards')).toMatch(/normal.*(height|computed)/);
    expect(words('generate.button')).toMatch(/normal.*height/);
    expect(words('settings.env')).toContain('never stored');
    expect(words('settings.keys')).toContain('encrypted');
  });

  it('TestR22_the_map_card_steps_show_the_card_buttons_and_the_mask_properties_step_selects_a_swatch', () => {
    const byId = Object.fromEntries(STEPS.map((entry) => [entry.id, entry]));
    expect(byId['maps.card-actions']?.reveal).toContain('map-actions');
    expect(byId['maps.normal']?.reveal).toContain('map-actions');
    expect(byId['maps.occlusion']?.reveal).toContain('map-actions');
    expect(byId['masks.properties']?.reveal).toEqual(['mask-display', 'mask-select']);
  });

  it('TestR23_only_the_environment_step_needs_the_host_and_its_words_say_where_it_is_available', () => {
    expect(STEPS.filter((entry) => entry.needs !== undefined).map((entry) => entry.id)).toEqual(['settings.env']);
    expect(TEXT['settings.env']?.paragraphs.join(' ')).toMatch(/exe and local web builds/);
  });

  it('TestR13_the_swatches_step_says_activate_not_highlight_and_the_properties_step_names_the_sliders', () => {
    expect(TEXT['masks.swatches']?.paragraphs.join(' ')).toMatch(/click it to activate/);
    expect(TEXT['masks.properties']?.paragraphs.join(' ')).toMatch(/Roughness.*Metalness.*Height.*Colour mixin.*Reset all.*Re-run decomposition/);
  });
});
