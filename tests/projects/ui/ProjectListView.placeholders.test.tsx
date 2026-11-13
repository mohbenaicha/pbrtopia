// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectListView, type ListViewStore } from '../../../src/projects/ui/ProjectListView';

afterEach(cleanup);

const emptyStore: ListViewStore = {
  listProjects: vi.fn(async () => ({ ok: true as const, value: [] })),
  renameProject: vi.fn(async () => ({ ok: true as const, value: undefined })),
  deleteProjects: vi.fn(async () => ({ ok: true as const, value: undefined })),
  loadThumbnail: vi.fn(async () => null),
};

describe('ProjectListView placeholder cards (materialgen/default-projects R12)', () => {
  it('TestR12_placeholder_cards_stand_in_for_the_projects_that_are_loading_and_the_empty_state_is_not_shown', async () => {
    render(<ProjectListView store={emptyStore} onOpen={vi.fn()} placeholderCount={4} />);
    expect(await screen.findAllByTestId('project-card-placeholder')).toHaveLength(4);
    expect(screen.queryByTestId('empty-state')).toBeNull();
  });

  it('TestR12_the_placeholders_are_hidden_from_screen_readers', async () => {
    render(<ProjectListView store={emptyStore} onOpen={vi.fn()} placeholderCount={2} />);
    for (const card of await screen.findAllByTestId('project-card-placeholder')) expect(card.getAttribute('aria-hidden')).toBe('true');
  });

  it('TestR12_a_new_refresh_token_reads_the_list_again_so_an_arrived_project_replaces_a_placeholder_without_a_loading_message', async () => {
    let projects: Array<{ id: string; name: string; updatedAt: string; detail: string }> = [];
    const store: ListViewStore = { ...emptyStore, listProjects: vi.fn(async () => ({ ok: true as const, value: [...projects] })) };
    const view = render(<ProjectListView store={store} onOpen={vi.fn()} placeholderCount={2} refreshToken={0} />);
    expect(await screen.findAllByTestId('project-card-placeholder')).toHaveLength(2);
    projects = [{ id: 'a', name: 'Fungal-Bark', updatedAt: '2026-11-13T10:00:00.000Z', detail: 'Texture · 1024 px' }];
    view.rerender(<ProjectListView store={store} onOpen={vi.fn()} placeholderCount={1} refreshToken={1} />);
    expect(await screen.findByText('Fungal-Bark')).toBeTruthy();
    expect(screen.getAllByTestId('project-card-placeholder')).toHaveLength(1);
    expect(screen.queryByText('Loading projects')).toBeNull();
  });

  it('TestR12_with_no_placeholders_the_empty_state_shows_as_before', async () => {
    render(<ProjectListView store={emptyStore} onOpen={vi.fn()} />);
    expect(await screen.findByTestId('empty-state')).toBeTruthy();
    expect(screen.queryByTestId('project-card-placeholder')).toBeNull();
  });
});
