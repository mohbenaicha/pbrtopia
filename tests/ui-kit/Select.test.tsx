// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Select } from '../../src/ui-kit';

afterEach(cleanup);

const models = [
  { value: 'gemini-3-flash', label: 'gemini-3-flash' },
  { value: 'gpt-5-mini', label: 'gpt-5-mini' },
  { value: 'other', label: 'other' },
];

describe('Select', () => {
  it('R22 it shows the selected label on a closed combobox with a listbox that is not rendered', () => {
    render(<Select label="Prompt enhancer model" options={models} value="gpt-5-mini" onChange={() => undefined} />);
    const box = screen.getByRole('combobox', { name: 'Prompt enhancer model' });
    expect(box.textContent).toContain('gpt-5-mini');
    expect(box.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('R22 clicking opens the list, choosing an option reports it and closes the list', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Select label="Prompt enhancer model" options={models} value="gemini-3-flash" onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: 'Prompt enhancer model' }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'gemini-3-flash' }).getAttribute('aria-selected')).toBe('true');
    await user.click(screen.getByRole('option', { name: 'gpt-5-mini' }));
    expect(onChange).toHaveBeenCalledWith('gpt-5-mini');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('R22 keyboard: ArrowDown opens, arrows move, Enter chooses, Escape closes without choosing', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Select label="Prompt enhancer model" options={models} value="gemini-3-flash" onChange={onChange} />);
    screen.getByRole('combobox', { name: 'Prompt enhancer model' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeTruthy();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('other');
    await user.keyboard('{ArrowDown}{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('R22 clicking outside closes the list', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">elsewhere</button>
        <Select label="Prompt enhancer model" options={models} value="gemini-3-flash" onChange={() => undefined} />
      </>,
    );
    await user.click(screen.getByRole('combobox', { name: 'Prompt enhancer model' }));
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('R22 with no options it is disabled and says so, never a blank box', () => {
    render(<Select label="Model" options={[]} value="" onChange={() => undefined} emptyText="No models found" />);
    const box = screen.getByRole('combobox', { name: 'Model' }) as HTMLButtonElement;
    expect(box.textContent).toContain('No models found');
    expect(box.disabled).toBe(true);
  });

  it('R22 a disabled select does not open', async () => {
    const user = userEvent.setup();
    render(<Select label="Model" options={models} value="other" onChange={() => undefined} disabled />);
    await user.click(screen.getByRole('combobox', { name: 'Model' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('R22 an error message is tied to the select', () => {
    render(<Select label="Model" options={models} value="other" onChange={() => undefined} error="Pick a model" />);
    const box = screen.getByRole('combobox', { name: 'Model' });
    expect(box.getAttribute('aria-invalid')).toBe('true');
    const message = screen.getByText('Pick a model');
    expect(box.getAttribute('aria-describedby')).toBe(message.id);
  });
});
