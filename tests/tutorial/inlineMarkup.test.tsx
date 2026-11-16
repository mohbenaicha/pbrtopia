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
