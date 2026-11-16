// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TourController } from '../../src/tutorial/TourController';
import { TourLayer } from '../../src/tutorial/TourLayer';
import type { TourSection, TourStage } from '../../src/tutorial/tourTypes';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const SECTIONS: TourSection[] = [
  { id: 'a', title: 'Alpha', steps: [{ id: 'one', anchor: 'one' }, { id: 'two', anchor: 'two' }, { id: 'three', anchor: 'three' }] },
];
const TEXTS = {
  one: { heading: 'First', paragraphs: ['Use the **Generate** button.', 'Second *paragraph*.'] },
  two: { heading: 'Second', paragraphs: ['short'] },
  three: { heading: 'Third', paragraphs: ['L'.repeat(900)] },
};

const stage: TourStage = { enter: async () => undefined, leave: async () => undefined };

function target(rect: { left: number; top: number; width: number; height: number }): HTMLElement {
  const element = document.createElement('button');
  element.dataset['tutorial'] = 'one';
  element.getBoundingClientRect = () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => ({}) });
  document.body.append(element);
  return element;
}

async function showing(findAnchor?: (anchor: string) => Promise<Element | null>) {
  const controller = new TourController({ sections: SECTIONS, stage, texts: TEXTS, ...(findAnchor === undefined ? {} : { findAnchor }) });
  render(<TourLayer controller={controller} />);
  act(() => controller.start());
  await waitFor(() => expect(controller.snapshot().phase).toBe('showing'));
  return controller;
}

const card = (): HTMLElement => screen.getByRole('dialog');

describe('TourLayer (tutorial R5, R6, R7, R12)', () => {
  it('TestR6_nothing_is_drawn_until_the_tour_starts', () => {
    const controller = new TourController({ sections: SECTIONS, stage, texts: TEXTS });
    render(<TourLayer controller={controller} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('.tour-veil, .tour-spotlight')).toBeNull();
  });

  it('TestR6_the_card_shows_counter_heading_words_and_the_three_buttons', async () => {
    await showing(async () => target({ left: 100, top: 100, width: 80, height: 30 }));
    expect(within(card()).getByText('1 / 3')).toBeTruthy();
    expect(within(card()).getByText('First')).toBeTruthy();
    expect(within(card()).getByText('Generate').tagName).toBe('STRONG');
    expect(within(card()).getByText('paragraph').tagName).toBe('EM');
    expect((within(card()).getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(card()).getByRole('button', { name: 'Next' })).toBeTruthy();
    expect(within(card()).getByRole('button', { name: 'Exit' })).toBeTruthy();
  });

  it('TestR12_the_card_is_a_dialog_named_by_its_heading_and_described_by_its_words', async () => {
    await showing(async () => target({ left: 100, top: 100, width: 80, height: 30 }));
    expect(card().getAttribute('aria-labelledby')).not.toBeNull();
    expect(document.getElementById(card().getAttribute('aria-labelledby') ?? '')?.textContent).toBe('First');
    expect(document.getElementById(card().getAttribute('aria-describedby') ?? '')?.textContent).toContain('Use the Generate button.');
  });

  it('TestR6_next_reads_done_on_the_last_step', async () => {
    const controller = await showing(async () => target({ left: 100, top: 100, width: 80, height: 30 }));
    fireEvent.click(within(card()).getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(controller.snapshot().index).toBe(1));
    await waitFor(() => expect(controller.snapshot().phase).toBe('showing'));
    fireEvent.click(within(card()).getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(controller.snapshot().index).toBe(2));
    await waitFor(() => expect(within(card()).getByRole('button', { name: 'Done' })).toBeTruthy());
  });

  it('TestR6_the_card_has_one_size_for_a_short_and_a_long_text', async () => {
    const controller = await showing(async () => target({ left: 100, top: 100, width: 80, height: 30 }));
    const first = card().style.cssText.match(/width: [^;]+; height: [^;]+/)?.[0];
    act(() => { controller.next(); controller.next(); });
    await waitFor(() => expect(controller.snapshot().index).toBe(2));
    await waitFor(() => expect(controller.snapshot().phase).toBe('showing'));
    expect(first).toBeTruthy();
    expect(card().style.cssText).toContain(first ?? 'x');
    expect(card().querySelector('.tour-card__body')).not.toBeNull();
  });

  it('TestR5_the_spotlight_sits_on_the_target_with_a_marching_ring_and_follows_a_resize', async () => {
    let rect = { left: 100, top: 100, width: 80, height: 30 };
    const element = target(rect);
    element.getBoundingClientRect = () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => ({}) });
    await showing(async () => element);
    const spotlight = document.querySelector<HTMLElement>('.tour-spotlight');
    expect(spotlight).not.toBeNull();
    expect(parseFloat(spotlight?.style.left ?? '')).toBeLessThanOrEqual(100);
    expect(parseFloat(spotlight?.style.width ?? '')).toBeGreaterThanOrEqual(80);
    expect(spotlight?.querySelector('rect[stroke-dasharray]')).not.toBeNull();
    rect = { left: 300, top: 200, width: 120, height: 60 };
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(parseFloat(document.querySelector<HTMLElement>('.tour-spotlight')?.style.left ?? '')).toBeGreaterThan(200));
  });

  it('TestR5_a_target_found_just_before_a_view_change_is_replaced_by_the_new_views_element_with_the_same_anchor', async () => {
    const old = target({ left: 100, top: 100, width: 80, height: 30 });
    await showing(async () => old);
    old.remove(); // the old view unmounted
    const fresh = target({ left: 400, top: 300, width: 90, height: 40 }); // the new view's element carries the same anchor
    expect(fresh.dataset['tutorial']).toBe('one');
    await waitFor(() => expect(parseFloat(document.querySelector<HTMLElement>('.tour-spotlight')?.style.left ?? '')).toBeGreaterThan(300));
  });

  it('TestR5_the_ring_stops_marching_under_reduced_motion', () => {
    const css = readFileSync('src/tutorial/tour.css', 'utf8');
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*tour-spotlight__ring[\s\S]*animation: none/);
  });

  it('TestR8_a_step_without_a_target_shows_a_centred_card_with_no_spotlight', async () => {
    await showing(async () => null);
    expect(document.querySelector('.tour-spotlight')).toBeNull();
    expect(document.querySelector('.tour-veil')).not.toBeNull();
    expect(card().getAttribute('data-side')).toBe('center');
  });

  it('TestR7_arrow_keys_and_escape_drive_the_tour', async () => {
    const controller = await showing(async () => target({ left: 100, top: 100, width: 80, height: 30 }));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(controller.snapshot().index).toBe(1));
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => expect(controller.snapshot().index).toBe(0));
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(controller.snapshot().active).toBe(false));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('TestR7_a_click_anywhere_outside_the_card_goes_to_the_next_step_but_one_on_the_card_body_does_not', async () => {
    const controller = await showing(async () => target({ left: 100, top: 100, width: 80, height: 30 }));
    fireEvent.click(card().querySelector('.tour-card__body') as Element);
    expect(controller.snapshot().index).toBe(0);
    fireEvent.click(document.body);
    await waitFor(() => expect(controller.snapshot().index).toBe(1));
  });

  it('TestR7_a_click_on_the_target_itself_goes_to_the_next_step_and_does_not_reach_it', async () => {
    const element = target({ left: 100, top: 100, width: 80, height: 30 });
    const reached = vi.fn();
    element.addEventListener('click', reached);
    const controller = await showing(async () => element);
    fireEvent.click(element);
    await waitFor(() => expect(controller.snapshot().index).toBe(1));
    expect(reached).not.toHaveBeenCalled();
  });

  it('TestR7_pointer_and_key_events_do_not_reach_the_app_under_the_tour', async () => {
    await showing(async () => target({ left: 100, top: 100, width: 80, height: 30 }));
    const seen = vi.fn();
    for (const type of ['pointerdown', 'mousedown', 'keydown', 'contextmenu', 'wheel']) document.addEventListener(type, seen);
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    fireEvent.contextMenu(document.body);
    fireEvent.wheel(document.body);
    fireEvent.keyDown(document.body, { key: 'Escape' }); // last: it ends the tour
    expect(seen).not.toHaveBeenCalled();
  });

  it('TestR7_a_press_on_the_card_does_not_reach_a_popover_that_would_dismiss_on_outside_press', async () => {
    await showing(async () => target({ left: 100, top: 100, width: 80, height: 30 }));
    const seen = vi.fn();
    document.addEventListener('pointerdown', seen);
    fireEvent.pointerDown(within(card()).getByRole('button', { name: 'Next' }));
    expect(seen).not.toHaveBeenCalled();
  });

  it('TestR7_focus_goes_to_the_card_and_comes_back_when_the_tour_ends', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const controller = await showing(async () => target({ left: 100, top: 100, width: 80, height: 30 }));
    await waitFor(() => expect(card().contains(document.activeElement)).toBe(true));
    act(() => controller.exit());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('TestR7_tab_stays_inside_the_card', async () => {
    await showing(async () => target({ left: 100, top: 100, width: 80, height: 30 }));
    const exit = within(card()).getByRole('button', { name: 'Exit' });
    const next = within(card()).getByRole('button', { name: 'Next' });
    next.focus();
    fireEvent.keyDown(next, { key: 'Tab' });
    expect(document.activeElement).toBe(exit);
    fireEvent.keyDown(exit, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(next);
  });
});
