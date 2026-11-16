import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TUTORIAL_SECTIONS } from '../../../src/materialgen/tutorial/tutorialSteps';

const SOURCE = readdirSync('src', { recursive: true })
  .map(String)
  .filter((path) => path.endsWith('.tsx') && !path.startsWith('tutorial'))
  .map((path) => readFileSync(`src/${path}`, 'utf8'))
  .join('\n');

const ANCHORS = TUTORIAL_SECTIONS.flatMap((section) => section.steps.map((step) => step.anchor));
const SETTINGS_ANCHOR = /^settings-(keys|models|storage)$/; // set once for every Settings section: data-tutorial={`settings-${section}`}

describe('the tour targets exist in the source (tutorial R10)', () => {
  it.each([...new Set(ANCHORS)])('TestR10_anchor_%s_is_set_by_a_component', (anchor) => {
    if (SETTINGS_ANCHOR.test(anchor)) expect(SOURCE).toContain('data-tutorial={`settings-${section}`}');
    else expect(SOURCE).toMatch(new RegExp(`tutorial=(\\{[^}]*)?["']${anchor}["']`));
  });
});
