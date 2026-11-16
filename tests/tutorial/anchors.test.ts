// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { anchorSelector, waitForAnchor } from '../../src/tutorial/anchors';

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('anchors (tutorial R8, R10)', () => {
  it('TestR10_the_selector_is_the_data_tutorial_attribute', () => {
    expect(anchorSelector('maps-tools')).toBe('[data-tutorial="maps-tools"]');
  });

  it('TestR10_an_anchor_already_in_the_page_is_found_at_once', async () => {
    document.body.innerHTML = '<div data-tutorial="x"></div>';
    expect(await waitForAnchor('x', 1500, new AbortController().signal)).toBe(document.querySelector('[data-tutorial="x"]'));
  });

  it('TestR8_an_anchor_that_appears_later_is_found', async () => {
    const found = waitForAnchor('late', 1500, new AbortController().signal);
    const element = document.createElement('div');
    element.dataset['tutorial'] = 'late';
    setTimeout(() => document.body.append(element), 10);
    expect(await found).toBe(element);
  });

  it('TestR8_an_anchor_that_never_appears_gives_null_after_the_timeout', async () => {
    vi.useFakeTimers();
    const found = waitForAnchor('never', 1500, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(1600);
    expect(await found).toBeNull();
  });

  it('TestR8_an_aborted_wait_gives_null', async () => {
    const controller = new AbortController();
    const found = waitForAnchor('never', 1500, controller.signal);
    controller.abort();
    expect(await found).toBeNull();
  });
});
