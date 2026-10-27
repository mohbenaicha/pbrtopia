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

  it('R28 with keepMounted nothing is drawn until the first open, then a closed section keeps its content mounted but hidden and the same element is shown again', () => {
    const closed = <Disclosure title="Skin" open={false} onOpenChange={() => undefined} keepMounted><p>inside</p></Disclosure>;
    const opened = <Disclosure title="Skin" open onOpenChange={() => undefined} keepMounted><p>inside</p></Disclosure>;
    const { rerender } = render(closed);
    expect(screen.queryByText('inside')).toBeNull();
    rerender(opened);
    const inside = screen.getByText('inside');
    expect(inside.closest('[hidden]')).toBeNull();
    rerender(closed);
    expect(screen.getByText('inside', { selector: 'p' })).toBe(inside);
    expect(inside.closest('[hidden]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Skin' }).getAttribute('aria-expanded')).toBe('false');
    rerender(opened);
    expect(screen.getByText('inside')).toBe(inside);
    expect(screen.getByRole('region', { name: 'Skin' })).toBeTruthy();
  });

  it('R28 without keepMounted the content is created again on every open', () => {
    const { rerender } = render(<Disclosure title="Skin" open onOpenChange={() => undefined}><p>inside</p></Disclosure>);
    const first = screen.getByText('inside');
    rerender(<Disclosure title="Skin" open={false} onOpenChange={() => undefined}><p>inside</p></Disclosure>);
    rerender(<Disclosure title="Skin" open onOpenChange={() => undefined}><p>inside</p></Disclosure>);
    expect(screen.getByText('inside')).not.toBe(first);
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

  it('R24 actions are buttons beside the heading, not inside it: clicking one does not toggle the section', async () => {
    const onOpenChange = vi.fn();
    const onAct = vi.fn();
    render(<Disclosure title="Skin" open={false} onOpenChange={onOpenChange} actions={<button type="button" onClick={onAct}>Delete</button>}>body</Disclosure>);
    const heading = screen.getByRole('button', { name: 'Skin' });
    const action = screen.getByRole('button', { name: 'Delete' });
    expect(heading.contains(action)).toBe(false);
    await userEvent.click(action);
    expect(onAct).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
    await userEvent.click(heading);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
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
