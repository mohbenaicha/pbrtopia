import { describe, expect, it } from 'vitest';
import { parseTutorialText } from '../../src/tutorial/tutorialText';

const RAW = [
  'Anything before the first step line is a comment and ignored.',
  '',
  '## generate.prompt | Prompt',
  'Describe the **material** you want.',
  '',
  'A second *paragraph*',
  'on two lines.',
  '',
  '## maps.cards | Map cards',
  'One line.',
  '',
].join('\n');

describe('tutorial text (tutorial R9)', () => {
  it('TestR9_reads_the_step_line_as_id_and_heading_and_the_body_as_paragraphs', () => {
    const texts = parseTutorialText(RAW);
    expect(Object.keys(texts)).toEqual(['generate.prompt', 'maps.cards']);
    expect(texts['generate.prompt']).toEqual({ heading: 'Prompt', paragraphs: ['Describe the **material** you want.', 'A second *paragraph* on two lines.'] });
    expect(texts['maps.cards']?.paragraphs).toEqual(['One line.']);
  });

  it('TestR9_text_before_the_first_step_line_is_ignored', () => {
    expect(parseTutorialText('only a comment\n').constructor).toBe(Object);
    expect(Object.keys(parseTutorialText('only a comment\n'))).toEqual([]);
  });

  it('TestR9_a_step_id_given_twice_is_an_error_so_editing_cannot_hide_words', () => {
    expect(() => parseTutorialText('## a | A\nx\n\n## a | B\ny\n')).toThrow(/twice/);
  });

  it('TestR9_a_step_line_without_a_heading_is_an_error', () => {
    expect(() => parseTutorialText('## a\nx\n')).toThrow(/heading/);
  });
});
