// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QualitySelect } from '../../../src/generation/ui/QualitySelect';

afterEach(cleanup);

describe('QualitySelect (R5)', () => {
  it('R5 the levels are listed in the order given, named as the provider names them, and choosing one reports it', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<QualitySelect levels={['low', 'medium', 'high']} value="medium" onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: 'Quality' }).textContent).toContain('medium');
    await user.click(screen.getByRole('combobox', { name: 'Quality' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['low', 'medium', 'high']);
    await user.click(screen.getByRole('option', { name: 'high' }));
    expect(onChange).toHaveBeenCalledWith('high');
  });

  it('R5 a model with no levels shows a disabled box that says so, also when no level is chosen', () => {
    render(<QualitySelect levels={[]} value={null} onChange={() => undefined} />);
    const box = screen.getByRole('combobox', { name: 'Quality' }) as HTMLButtonElement;
    expect(box.disabled).toBe(true);
    expect(box.textContent).toContain('No quality levels for this model');
  });
});
