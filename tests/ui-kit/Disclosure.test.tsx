// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Disclosure } from '../../src/ui-kit';

afterEach(cleanup);

describe('Disclosure', () => {
  it('R22 it is a button that says whether its section is open, and the open section is a region named by it', () => {
    const { rerender } = render(<Disclosure title="Skin" open={false} onOpenChange={() => undefined}>body</Disclosure>);
    expect(screen.getByRole('button', { name: 'Skin' }).getAttribute('aria-expanded')).toBe('false');
    rerender(<Disclosure title="Skin" open onOpenChange={() => undefined}>body</Disclosure>);
    expect(screen.getByRole('button', { name: 'Skin' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('region', { name: 'Skin' }).textContent).toBe('body');
  });

  it('R22 closed content is not rendered at all', () => {
    render(<Disclosure title="Skin" open={false} onOpenChange={() => undefined}><p>inside</p></Disclosure>);
    expect(screen.queryByText('inside')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('R22 a click reports the opposite state', async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<Disclosure title="Skin" open={false} onOpenChange={onOpenChange}>body</Disclosure>);
    await userEvent.click(screen.getByRole('button', { name: 'Skin' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    rerender(<Disclosure title="Skin" open onOpenChange={onOpenChange}>body</Disclosure>);
    await userEvent.click(screen.getByRole('button', { name: 'Skin' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('R22 Enter and Space toggle it from the keyboard', async () => {
    const onOpenChange = vi.fn();
    render(<Disclosure title="Skin" open={false} onOpenChange={onOpenChange}>body</Disclosure>);
    screen.getByRole('button', { name: 'Skin' }).focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it('R22 disabled: the heading cannot be focused, ignores a click and the keys, and cannot be tabbed to', async () => {
    const onOpenChange = vi.fn();
    render(
      <>
        <Disclosure title="Skin" open={false} onOpenChange={onOpenChange} disabled>body</Disclosure>
        <button type="button">after</button>
      </>,
    );
    const heading = screen.getByRole('button', { name: 'Skin' }) as HTMLButtonElement;
    expect(heading.disabled).toBe(true);
    heading.focus();
    expect(document.activeElement).not.toBe(heading);
    await userEvent.click(heading);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'after' }));
    await userEvent.keyboard('{Enter}');
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
