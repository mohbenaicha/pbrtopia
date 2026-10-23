// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ResolutionOption } from '../../../src/generation/catalog/modelTypes';
import { ResolutionSelect } from '../../../src/generation/ui/ResolutionSelect';

afterEach(cleanup);

const OPTIONS: ResolutionOption[] = [{ key: '1K', sizePx: 1024 }, { key: '2K', sizePx: 2048 }, { key: '4K', sizePx: 4096 }];

describe('ResolutionSelect (R4)', () => {
  it('R4 each size the model offers is listed with its pixels, and choosing one reports its key', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ResolutionSelect options={OPTIONS} experimental={[]} value="1K" onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: 'Resolution' }).textContent).toContain('1K (1024 px)');
    await user.click(screen.getByRole('combobox', { name: 'Resolution' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['1K (1024 px)', '2K (2048 px)', '4K (4096 px)']);
    await user.click(screen.getByRole('option', { name: '2K (2048 px)' }));
    expect(onChange).toHaveBeenCalledWith('2K');
  });

  it('R4 only the sizes the provider documents as experimental are marked experimental', async () => {
    const user = userEvent.setup();
    render(<ResolutionSelect options={OPTIONS} experimental={['4K']} value={null} onChange={() => undefined} />);
    await user.click(screen.getByRole('combobox', { name: 'Resolution' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['1K (1024 px)', '2K (2048 px)', '4K (4096 px) experimental']);
  });

  it('R4 a model that offers no size shows a disabled box that says so', () => {
    render(<ResolutionSelect options={[]} experimental={[]} value={null} onChange={() => undefined} />);
    const box = screen.getByRole('combobox', { name: 'Resolution' }) as HTMLButtonElement;
    expect(box.disabled).toBe(true);
    expect(box.textContent).toContain('No sizes for this model');
  });
});
