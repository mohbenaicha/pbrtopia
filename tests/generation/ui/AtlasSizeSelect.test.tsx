// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listAtlasSizes } from '../../../src/generation/catalog/atlasSizes';
import { AtlasSizeSelect } from '../../../src/generation/ui/AtlasSizeSelect';

afterEach(cleanup);

describe('AtlasSizeSelect (R16)', () => {
  it('R16 the closed box shows the current size with its pixels', () => {
    render(<AtlasSizeSelect options={listAtlasSizes(4096)} value="2K" onChange={() => undefined} />);
    expect(screen.getByRole('combobox', { name: 'Atlas size' }).textContent).toContain('2K (2048 px)');
  });

  it('R16 every size the device can make is offered, and choosing one reports its key', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AtlasSizeSelect options={listAtlasSizes(4096)} value="2K" onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: 'Atlas size' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['1K (1024 px)', '2K (2048 px)', '4K (4096 px)']);
    await user.click(screen.getByRole('option', { name: '4K (4096 px)' }));
    expect(onChange).toHaveBeenCalledWith('4K');
  });

  it('R16 a device with no usable size shows a disabled box that says so', () => {
    render(<AtlasSizeSelect options={[]} value="2K" onChange={() => undefined} />);
    const box = screen.getByRole('combobox', { name: 'Atlas size' }) as HTMLButtonElement;
    expect(box.disabled).toBe(true);
    expect(box.textContent).toContain('No atlas sizes on this device');
  });
});
