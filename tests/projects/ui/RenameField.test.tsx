// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RenameField } from '../../../src/projects/ui/RenameField';

afterEach(cleanup);

function show(save: (name: string) => Promise<string | null> = async () => null) {
  const saveName = vi.fn(save);
  const cancel = vi.fn();
  render(<RenameField initialName="Orc helmet" save={saveName} cancel={cancel} />);
  return { saveName, cancel, input: screen.getByRole('textbox', { name: 'Project name' }) as HTMLInputElement };
}

describe('RenameField', () => {
  it('projects R8 it starts with the current name in the field and the keyboard focus on it', () => {
    const { input } = show();
    expect(input.value).toBe('Orc helmet');
    expect(document.activeElement).toBe(input);
  });

  it('projects R8 Enter keeps the new name, trimmed', async () => {
    const { saveName, input } = show();
    await userEvent.clear(input);
    await userEvent.type(input, '  Troll club  {Enter}');
    expect(saveName).toHaveBeenCalledWith('Troll club');
  });

  it('projects R8 Save works like Enter', async () => {
    const { saveName, input } = show();
    await userEvent.clear(input);
    await userEvent.type(input, 'Troll club');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(saveName).toHaveBeenCalledWith('Troll club');
  });

  it('projects R8 Escape and Cancel drop the edit without saving', async () => {
    const { saveName, cancel, input } = show();
    await userEvent.type(input, 'x{Escape}');
    expect(cancel).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(saveName).not.toHaveBeenCalled();
  });

  it('projects R8 an empty or over-long name is refused with a message and not saved', async () => {
    const { saveName, input } = show();
    await userEvent.clear(input);
    await userEvent.keyboard('{Enter}');
    expect(screen.getByText('Enter a name of 1 to 120 characters.')).toBeTruthy();
    await userEvent.click(input);
    await userEvent.paste('x'.repeat(121));
    await userEvent.keyboard('{Enter}');
    expect(screen.getByText('Enter a name of 1 to 120 characters.')).toBeTruthy();
    expect(saveName).not.toHaveBeenCalled();
  });

  it('projects R8 a save that fails shows its message and keeps the field and the typed name', async () => {
    const { input } = show(async () => 'Browser storage is full.');
    await userEvent.type(input, '2{Enter}');
    expect(await screen.findByText('Browser storage is full.')).toBeTruthy();
    expect(input.value).toBe('Orc helmet2');
    expect(input.disabled).toBe(false);
  });

  it('projects R8 while the save runs the field is locked and a second Enter writes nothing more', async () => {
    let finish: (failure: string | null) => void = () => undefined;
    const { saveName, input } = show(() => new Promise<string | null>((resolve) => void (finish = resolve)));
    await userEvent.type(input, '{Enter}');
    expect(input.disabled).toBe(true);
    await userEvent.keyboard('{Enter}');
    expect(saveName).toHaveBeenCalledTimes(1);
    finish(null);
  });
});
