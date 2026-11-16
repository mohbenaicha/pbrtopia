// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const WELCOME = 'Welcome to pbrtopia';
const welcome = () => screen.queryByRole('dialog', { name: WELCOME });
const tour = () => screen.queryByRole('dialog', { name: /^(?!Welcome to pbrtopia)./ });
const app = (ready: boolean, onGenerateMaterial = vi.fn()) => (
  <MaterialTutorial store={store} ready={ready} onGenerateMaterial={onGenerateMaterial}>
    <TutorialButton />
  </MaterialTutorial>
);

describe('MaterialTutorial (tutorial R1, R2, R15, R18)', () => {
  it('TestR2_the_welcome_shows_by_itself_once_the_app_is_ready_and_saves_the_flag_at_once_without_starting_the_tour', async () => {
    const { rerender } = render(app(false));
    expect(window.localStorage.getItem(TUTORIAL_SEEN_KEY)).toBeNull(); // not ready: nothing shows
    expect(welcome()).toBeNull();
    rerender(app(true));
    expect(await screen.findByRole('dialog', { name: WELCOME })).toBeTruthy();
    expect(window.localStorage.getItem(TUTORIAL_SEEN_KEY)).not.toBeNull();
    expect(tour()).toBeNull();
  });

  it('TestR2_a_device_that_has_seen_the_welcome_does_not_show_it_again', async () => {
    window.localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
    render(app(true));
    await act(async () => undefined);
    expect(welcome()).toBeNull();
  });

  it('TestR2_after_the_welcome_closes_a_later_ready_change_does_not_show_it_again', async () => {
    const { rerender } = render(app(true));
    await screen.findByRole('dialog', { name: WELCOME });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(welcome()).toBeNull();
    rerender(app(false));
    rerender(app(true));
    await act(async () => undefined);
    expect(welcome()).toBeNull();
    expect(tour()).toBeNull(); // Esc closed the welcome and did nothing else (R15)
  });

  it('TestR15_start_with_tutorial_closes_the_welcome_and_starts_the_tour', async () => {
    const onGenerateMaterial = vi.fn();
    render(app(true, onGenerateMaterial));
    await screen.findByRole('dialog', { name: WELCOME });
    fireEvent.click(screen.getByRole('button', { name: 'Start with tutorial' }));
    expect(welcome()).toBeNull();
    expect(await screen.findByRole('dialog', { name: /^(?!Welcome to pbrtopia)./ }, { timeout: 4000 })).toBeTruthy();
    expect(onGenerateMaterial).not.toHaveBeenCalled();
  });

  it('TestR15_generate_material_closes_the_welcome_asks_for_a_new_project_and_starts_no_tour', async () => {
    const onGenerateMaterial = vi.fn();
    render(app(true, onGenerateMaterial));
    await screen.findByRole('dialog', { name: WELCOME });
    fireEvent.click(screen.getByRole('button', { name: 'Generate material' }));
    expect(welcome()).toBeNull();
    expect(onGenerateMaterial).toHaveBeenCalledTimes(1);
    await act(async () => undefined);
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
  });

  it('TestR18_the_tutorial_button_starts_the_tour_without_the_welcome_even_when_seen', async () => {
    window.localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
    render(app(false));
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Tutorial' }));
    expect(await screen.findByRole('dialog', { name: /^(?!Welcome to pbrtopia)./ }, { timeout: 4000 })).toBeTruthy();
    expect(welcome()).toBeNull();
  });
});
