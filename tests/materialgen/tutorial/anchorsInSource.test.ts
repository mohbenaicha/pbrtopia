import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TUTORIAL_SECTIONS } from '../../../src/materialgen/tutorial/tutorialSteps';

const SOURCE = readdirSync('src', { recursive: true })
  .map(String)
  .filter((path) => path.endsWith('.tsx') && !path.startsWith('tutorial'))
  .map((path) => readFileSync(`src/${path}`, 'utf8'))
  .join('\n');

const ANCHORS = TUTORIAL_SECTIONS.flatMap((section) => section.steps.map((step) => step.anchor));

describe('the tour targets exist in the source (tutorial R10)', () => {
  it.each([...new Set(ANCHORS)])('TestR10_anchor_%s_is_set_by_a_component', (anchor) => {
    expect(SOURCE).toMatch(new RegExp(`tutorial[=:] ?(\\{[^}]*)?["']${anchor}["']`)); // a prop (tutorial="x", tutorial={...'x'...}) or a tab option (tutorial: 'x')
  });
});
