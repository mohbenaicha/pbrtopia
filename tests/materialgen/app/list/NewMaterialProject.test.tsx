// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { storeFailure } from '@shared/projects';
import { NewMaterialProjectButton } from '@mat/app/list/NewMaterialProjectButton';
import { NewMaterialProjectDialog } from '@mat/app/list/NewMaterialProjectDialog';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('materialgen/app new project dialog', () => {
  it('R24 it asks for a name (placeholder Project name) and a size defaulting to Auto, with Cancel and Create', () => {
    render(<NewMaterialProjectDialog busy={false} error={null} onCreate={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'New project' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Project name')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Size' }).textContent).toContain('Auto (from first image)');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy();
  });

  it('R24a Create stays disabled until the name is valid', () => {
    render(<NewMaterialProjectDialog busy={false} error={null} onCreate={vi.fn()} onCancel={vi.fn()} />);
    const create = screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('Project name'), { target: { value: '   ' } });
    expect(create.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('Project name'), { target: { value: ' Bricks ' } });
    expect(create.disabled).toBe(false);
  });

  it('R24a Enter does what clicking Create does, with the trimmed name and the Auto size as null', () => {
    const onCreate = vi.fn();
    render(<NewMaterialProjectDialog busy={false} error={null} onCreate={onCreate} onCancel={vi.fn()} />);
    const field = screen.getByPlaceholderText('Project name');
    fireEvent.change(field, { target: { value: ' Bricks ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onCreate).toHaveBeenCalledExactlyOnceWith('Bricks', null);
  });

  it('R24a Cancel creates nothing', () => {
    const onCreate = vi.fn();
    const onCancel = vi.fn();
    render(<NewMaterialProjectDialog busy={false} error={null} onCreate={onCreate} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe('materialgen/app new project button', () => {
  const made = { id: 'p-1' };

  it('R24a Create makes an empty project with the chosen name, asks for persistence and opens its address', async () => {
    const store = { createProject: vi.fn(async () => ({ ok: true as const, value: made })), requestPersistence: vi.fn(async () => true) };
    render(<NewMaterialProjectButton store={store as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'New project' }));
    const field = screen.getByPlaceholderText('Project name');
    fireEvent.change(field, { target: { value: 'Bricks' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(window.location.hash).toBe('#/p/p-1'));
    expect(store.createProject).toHaveBeenCalledWith({ name: 'Bricks', size: null });
    expect(store.requestPersistence).toHaveBeenCalledTimes(1);
  });

  it('R24a a refused create is shown in the dialog and nothing is opened', async () => {
    const store = { createProject: vi.fn(async () => storeFailure('storage-unavailable', 'Storage is not available.')), requestPersistence: vi.fn() };
    render(<NewMaterialProjectButton store={store as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'New project' }));
    fireEvent.change(screen.getByPlaceholderText('Project name'), { target: { value: 'Bricks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Storage is not available.');
    expect(window.location.hash).toBe('');
    expect(store.requestPersistence).not.toHaveBeenCalled();
  });
});
