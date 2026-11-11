// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewShadingControl } from '../../../../src/materialgen/preview/ui/PreviewShadingControl';

afterEach(cleanup);

describe('materialgen/preview R51 the view mode selector', () => {
  it('R51 offers Shaded, Albedo, Normal, Rough, Metal, Height and AO in one group with the current one chosen', () => {
    render(<PreviewShadingControl value="rough" onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: 'Shading mode' });
    const radios = [...group.querySelectorAll('[role="radio"]')];
    expect(radios.map((radio) => radio.getAttribute('aria-label') ?? radio.textContent)).toEqual(['Shaded', 'Albedo', 'Normal', 'Rough', 'Metal', 'Height', 'AO']);
    expect(radios.filter((radio) => radio.getAttribute('aria-checked') === 'true').map((radio) => radio.getAttribute('aria-label'))).toEqual(['Rough']);
  });

  it('R51 choosing a mode reports it', async () => {
    const onChange = vi.fn();
    render(<PreviewShadingControl value="lit" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Height' }));
    expect(onChange).toHaveBeenCalledWith('height');
    await userEvent.click(screen.getByRole('radio', { name: 'AO' }));
    expect(onChange).toHaveBeenCalledWith('ao');
  });
});
