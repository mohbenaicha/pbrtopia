// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DETAIL_LEVELS, type NormalDetail } from '../../../src/generation';
import { DetailSlider } from '../../../src/generation/ui/DetailSlider';

afterEach(cleanup);

describe('DetailSlider (normal-map R5)', () => {
  it('normal-map R5 is a slider of four steps, 1 to 4', () => {
    render(<DetailSlider value={2} onChange={() => undefined} />);
    const slider = screen.getByRole('slider', { name: 'Detail' }) as HTMLInputElement;
    expect([slider.min, slider.max, slider.step]).toEqual(['1', '4', '1']);
  });

  it('normal-map R5 shows the name of the chosen step beside the slider, for each of the four steps', () => {
    const names: string[] = [];
    for (const level of [1, 2, 3, 4] as NormalDetail[]) {
      const { unmount } = render(<DetailSlider value={level} onChange={() => undefined} />);
      names.push(screen.getByRole('status').textContent ?? '');
      unmount();
    }
    expect(names).toEqual(['Broad forms', 'Medium', 'Fine', 'Maximum']);
    expect(names).toEqual(DETAIL_LEVELS.map((level) => level.name));
  });

  it('normal-map R5 moving the slider reports the new step', () => {
    const onChange = vi.fn();
    render(<DetailSlider value={2} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Detail' }), { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('normal-map R5 its tooltip says it changes only what the image model is asked for', () => {
    render(<DetailSlider value={2} onChange={() => undefined} />);
    const hidden = document.querySelector('.ui-tooltip__description');
    expect(hidden?.textContent).toContain('relief');
  });
});
