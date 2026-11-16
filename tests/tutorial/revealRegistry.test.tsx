// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeReveal, openReveal, useRevealOnTour } from '../../src/tutorial/revealRegistry';

afterEach(cleanup);

function Owner({ open, close }: { open: () => void; close: () => void }): null {
  useRevealOnTour('popover', { open, close });
  return null;
}

describe('reveal registry (tutorial R4)', () => {
  it('TestR4_a_mounted_owner_is_opened_and_closed_through_its_id', () => {
    const open = vi.fn();
    const close = vi.fn();
    render(<Owner open={open} close={close} />);
    expect(openReveal('popover')).toBe(true);
    closeReveal('popover');
    expect(open).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('TestR4_an_id_nobody_registered_reports_false_and_closing_it_is_harmless', () => {
    expect(openReveal('nothing')).toBe(false);
    expect(() => closeReveal('nothing')).not.toThrow();
  });

  it('TestR4_an_unmounted_owner_is_forgotten', () => {
    const view = render(<Owner open={vi.fn()} close={vi.fn()} />);
    view.unmount();
    expect(openReveal('popover')).toBe(false);
  });

  it('TestR4_the_owners_newest_handlers_are_the_ones_called', () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = render(<Owner open={first} close={vi.fn()} />);
    view.rerender(<Owner open={second} close={vi.fn()} />);
    openReveal('popover');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
