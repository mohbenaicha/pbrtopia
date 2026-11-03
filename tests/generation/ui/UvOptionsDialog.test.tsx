// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UvOptionsDialog } from '../../../src/generation/ui/UvOptionsDialog';

afterEach(cleanup);

function setup(open = true) {
  const props = { onCancel: vi.fn(), onConfirm: vi.fn() };
  render(<UvOptionsDialog open={open} {...props} />);
  return props;
}
const padding = (): HTMLInputElement => screen.getByLabelText('Padding (texels)') as HTMLInputElement;
const confirm = (): HTMLButtonElement => screen.getByRole('button', { name: 'Generate UV' }) as HTMLButtonElement;

describe('UvOptionsDialog notice (mesh edit R32)', () => {
  it('mesh edit R32 says what the unwrap will do when the model has hidden parts', () => {
    render(<UvOptionsDialog open notice="Hidden parts will be shown." onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Hidden parts will be shown.')).toBeTruthy();
  });

  it('mesh edit R32 shows no notice when there is none', () => {
    setup();
    expect(screen.queryByText('Hidden parts will be shown.')).toBeNull();
  });
});

describe('UvOptionsDialog (R15)', () => {
  it('R15 renders nothing while closed', () => {
    setup(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('R15 opens with the engine defaults: 2K and 3 texels', () => {
    const { onConfirm } = setup();
    expect(screen.getByRole('combobox', { name: 'Atlas resolution' }).textContent).toMatch(/2K/);
    expect(padding().value).toBe('3');
    fireEvent.click(confirm());
    expect(onConfirm).toHaveBeenCalledWith({ resolution: 2048, paddingTexels: 3 });
  });

  it('R15 offers 1K, 2K and 4K and passes the chosen size as pixels', () => {
    const { onConfirm } = setup();
    fireEvent.click(screen.getByRole('combobox', { name: 'Atlas resolution' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent?.split(' ')[0])).toEqual(['1K', '2K', '4K']);
    fireEvent.click(screen.getByRole('option', { name: /^4K/ }));
    fireEvent.click(confirm());
    expect(onConfirm).toHaveBeenCalledWith({ resolution: 4096, paddingTexels: 3 });
  });

  it('R15 passes the padding typed as a whole number', () => {
    const { onConfirm } = setup();
    fireEvent.change(padding(), { target: { value: '8' } });
    fireEvent.click(confirm());
    expect(onConfirm).toHaveBeenCalledWith({ resolution: 2048, paddingTexels: 8 });
  });

  it('R15 padding 0 and 64 are valid', () => {
    for (const value of ['0', '64']) {
      cleanup();
      setup();
      fireEvent.change(padding(), { target: { value } });
      expect(confirm().disabled).toBe(false);
    }
  });

  it('R15 an invalid padding shows an error and disables the confirm button', () => {
    for (const value of ['', 'abc', '-1', '2.5', '65', '1e1']) {
      cleanup();
      const { onConfirm } = setup();
      fireEvent.change(padding(), { target: { value } });
      expect(confirm().disabled, value).toBe(true);
      expect(screen.getByText(/whole number from 0 to 64/)).toBeTruthy();
      fireEvent.click(confirm());
      expect(onConfirm).not.toHaveBeenCalled();
    }
  });

  it('R15 Cancel closes without a call', () => {
    const { onCancel, onConfirm } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('R15 reopening starts from the defaults again', () => {
    const props = { onCancel: vi.fn(), onConfirm: vi.fn() };
    const { rerender } = render(<UvOptionsDialog open {...props} />);
    fireEvent.change(padding(), { target: { value: '9' } });
    rerender(<UvOptionsDialog open={false} {...props} />);
    rerender(<UvOptionsDialog open {...props} />);
    expect(padding().value).toBe('3');
  });
});
