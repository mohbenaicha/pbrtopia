// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderInlineMarkup } from '../../src/tutorial/inlineMarkup';

const html = (text: string): string => render(<p>{renderInlineMarkup(text)}</p>).container.innerHTML;

describe('inline markup (tutorial R9)', () => {
  it('TestR9_bold_and_italic_become_strong_and_em', () => {
    expect(html('Press **Generate** then *wait*.')).toBe('<p>Press <strong>Generate</strong> then <em>wait</em>.</p>');
  });

  it('TestR9_html_in_the_words_is_shown_as_text_never_rendered', () => {
    expect(html('<img src=x onerror=alert(1)> **b**')).toBe('<p>&lt;img src=x onerror=alert(1)&gt; <strong>b</strong></p>');
  });

  it('TestR9_unmatched_markers_stay_as_typed', () => {
    expect(html('2 * 3 and **open')).toBe('<p>2 * 3 and **open</p>');
  });
});

describe('inline markup links (tutorial R20)', () => {
  const linked = (text: string): string => render(<p>{renderInlineMarkup(text, { releases: 'https://example.test/releases' })}</p>).container.innerHTML;

  it('TestR20_a_known_key_becomes_a_new_tab_link_that_does_not_give_the_page_away', () => {
    expect(linked('Get the [exe release](releases).')).toBe('<p>Get the <a href="https://example.test/releases" target="_blank" rel="noopener noreferrer">exe release</a>.</p>');
  });

  it('TestR20_an_unknown_key_or_an_address_of_its_own_shows_only_the_text', () => {
    expect(linked('See [here](nowhere) or [there](https://evil.test).')).toBe('<p>See here or [there](https://evil.test).</p>');
  });
});
