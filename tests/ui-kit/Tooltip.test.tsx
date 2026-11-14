// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from '@shared/ui-kit';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const button = (label: string): HTMLElement => screen.getByRole('button', { name: label });
const hover = (element: Element, pointerType = 'mouse'): void => {
  const event = new Event('pointerover', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  act(() => void element.dispatchEvent(event));
};
const leave = (element: Element): void => {
  const event = new Event('pointerout', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  act(() => void element.dispatchEvent(event));
};
const press = (element: Element): void => {
  const event = new Event('keydown', { bubbles: true });
  Object.defineProperty(event, 'key', { value: 'Tab' });
  act(() => void document.dispatchEvent(event));
  fireEvent.focus(element);
};
const advance = (ms: number): void => void act(() => void vi.advanceTimersByTime(ms));

function Pair() {
  return (
    <>
      <Tooltip heading="Size" text="How large each stamp is."><button type="button">A</button></Tooltip>
      <Tooltip heading="Hardness" text="The falloff."><button type="button">B</button></Tooltip>
    </>
  );
}

describe('ui-kit Tooltip (compositing R48)', () => {
  it('R48 it opens on mouse hover after 400 ms, not before, with the heading and the text', () => {
    render(<Pair />);
    hover(button('A'));
    advance(399);
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(2);
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('Size');
    expect(tip.textContent).toContain('How large each stamp is.');
  });

  it('R48 it closes when the pointer leaves, and a hover that leaves early never opens it', () => {
    render(<Pair />);
    hover(button('A'));
    advance(200);
    leave(button('A'));
    advance(500);
    expect(screen.queryByRole('tooltip')).toBeNull();
    hover(button('A'));
    advance(400);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    leave(button('A'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('R48 it never opens for touch', () => {
    render(<Pair />);
    hover(button('A'), 'touch');
    advance(1000);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('R48 keyboard focus opens it at once; a focus that follows a click does not', () => {
    render(<Pair />);
    press(button('A'));
    expect(screen.getByRole('tooltip').textContent).toContain('Size');
    fireEvent.blur(button('A'));
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.pointerDown(button('B'));
    fireEvent.focus(button('B'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('R48 Escape, a press and a scroll each close it', () => {
    render(<Pair />);
    press(button('A'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    press(button('A'));
    fireEvent.pointerDown(button('A'));
    expect(screen.queryByRole('tooltip')).toBeNull();
    press(button('A'));
    fireEvent.scroll(window);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('R48 only one is open at a time', () => {
    render(<Pair />);
    press(button('A'));
    press(button('B'));
    const tips = screen.getAllByRole('tooltip');
    expect(tips).toHaveLength(1);
    expect(tips[0]!.textContent).toContain('Hardness');
  });

  it('R48 the trigger is described by a hidden node holding the text, also while closed', () => {
    render(<Pair />);
    const id = button('A').getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    const hidden = document.getElementById(id!);
    expect(hidden?.textContent).toContain('How large each stamp is.');
    expect(hidden?.className).toContain('ui-tooltip__description');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('R48 the child keeps its own handlers and drops nothing it had', () => {
    const onClick = vi.fn();
    const onFocus = vi.fn();
    render(<Tooltip heading="H" text="T"><button type="button" onClick={onClick} onFocus={onFocus}>C</button></Tooltip>);
    fireEvent.click(button('C'));
    press(button('C'));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onFocus).toHaveBeenCalledOnce();
  });

  it('R48 over a tooltip inside another, only the inner one opens, and the outer returns when the pointer comes back out', () => {
    render(
      <Tooltip heading="Row" text="The whole row.">
        <div>
          <button type="button">Away</button>
          <Tooltip heading="Dice" text="The inner control."><button type="button">Inner</button></Tooltip>
        </div>
      </Tooltip>,
    );
    hover(button('Inner'));
    advance(500);
    const tips = screen.getAllByRole('tooltip');
    expect(tips).toHaveLength(1);
    expect(tips[0]!.textContent).toContain('Dice');
    leave(button('Inner'));
    hover(button('Away'));
    advance(500);
    expect(screen.getByRole('tooltip').textContent).toContain('Row');
  });

  it('R49 the pointer over a part marked data-tooltip-skip never opens the tooltip, and moving onto it cancels the wait; the rest of the row still does', () => {
    render(
      <Tooltip heading="Size" text="How large each stamp is.">
        <div>
          <span>Label</span>
          <button type="button" data-tooltip-skip="">Track</button>
        </div>
      </Tooltip>,
    );
    hover(screen.getByText('Label'));
    advance(200);
    hover(button('Track'));
    advance(1000);
    expect(screen.queryByRole('tooltip')).toBeNull();
    hover(button('Track'));
    advance(1000);
    expect(screen.queryByRole('tooltip')).toBeNull();
    hover(screen.getByText('Label'));
    advance(400);
    expect(screen.getByRole('tooltip').textContent).toContain('Size');
    hover(button('Track'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('R48 the visible panel never takes the pointer, and is removed with the component', () => {
    const { unmount } = render(<Pair />);
    press(button('A'));
    expect(screen.getByRole('tooltip').className).toContain('ui-tooltip');
    unmount();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
