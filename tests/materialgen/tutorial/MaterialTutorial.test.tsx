// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MaterialTutorial, TUTORIAL_SEEN_KEY } from '../../../src/materialgen/tutorial/MaterialTutorial';
import { TutorialButton } from '../../../src/materialgen/tutorial/TutorialButtons';

const store = {
  listProjects: async () => ({ ok: true as const, value: [] }),
  saveAppSettings: async () => ({ ok: true as const, value: undefined }),
};

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '#/projects';
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const tour = () => screen.queryByRole('dialog', { name: /./ });

describe('MaterialTutorial (tutorial R1, R2)', () => {
  it('TestR2_the_tour_starts_by_itself_once_the_app_is_ready_and_saves_the_flag_at_once', async () => {
    const { rerender } = render(<MaterialTutorial store={store} ready={false}><p>app</p></MaterialTutorial>);
    expect(window.localStorage.getItem(TUTORIAL_SEEN_KEY)).toBeNull(); // not ready: nothing starts
    rerender(<MaterialTutorial store={store} ready><p>app</p></MaterialTutorial>);
    expect(await screen.findByRole('dialog', {}, { timeout: 4000 })).toBeTruthy();
    expect(window.localStorage.getItem(TUTORIAL_SEEN_KEY)).not.toBeNull();
  });

  it('TestR2_a_device_that_has_seen_the_tour_does_not_start_it_again', async () => {
    window.localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
    render(<MaterialTutorial store={store} ready><p>app</p></MaterialTutorial>);
    await act(async () => undefined);
    expect(tour()).toBeNull();
  });

  it('TestR2_after_the_tour_ends_a_later_ready_change_does_not_start_it_again', async () => {
    const { rerender } = render(<MaterialTutorial store={store} ready><p>app</p></MaterialTutorial>);
    await screen.findByRole('dialog', {}, { timeout: 4000 });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(tour()).toBeNull();
    rerender(<MaterialTutorial store={store} ready={false}><p>app</p></MaterialTutorial>);
    rerender(<MaterialTutorial store={store} ready><p>app</p></MaterialTutorial>);
    await act(async () => undefined);
    expect(tour()).toBeNull();
  });

  it('TestR1_the_tutorial_button_starts_the_tour_even_when_it_has_been_seen', async () => {
    window.localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
    render(<MaterialTutorial store={store} ready={false}><TutorialButton /></MaterialTutorial>);
    expect(tour()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tutorial' }));
    expect(await screen.findByRole('dialog', {}, { timeout: 4000 })).toBeTruthy();
  });
});
