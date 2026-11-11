// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaskDisplayControl } from '../../../../src/materialgen/preview/ui/MaskDisplayControl';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const styles = readFileSync(resolve(process.cwd(), 'src/materialgen/preview/ui/maskDisplayControl.css'), 'utf8');

afterEach(cleanup);

type Props = Parameters<typeof MaskDisplayControl>[0];
const setup = (patch: Partial<Props> = {}) => {
  const props: Props = { hasLabels: true, overlay: false, onOverlayChange: vi.fn(), opacity: 0.5, onOpacityChange: vi.fn(), ...patch };
  render(
    <>
      <MaskDisplayControl {...props} />
      <button type="button">elsewhere</button>
    </>,
  );
  return props;
};
const icon = () => screen.getByRole('button', { name: 'Material Masks' });
const popover = () => screen.queryByRole('dialog', { name: 'Mask display' });

describe('materialgen/preview R28 R40 the Material Masks icon', () => {
  it('R28 the icon is always enabled and named Material Masks, also with no labels', () => {
    setup({ hasLabels: false });
    expect((icon() as HTMLButtonElement).disabled).toBe(false);
    expect(icon().getAttribute('data-testid')).toBe('preview-masks');
  });

  it('R28 a click opens the Mask display popover and lights the icon; a second click closes it', async () => {
    setup();
    await userEvent.click(icon());
    expect(popover()).toBeTruthy();
    expect(icon().getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(icon());
    expect(popover()).toBeNull();
    expect(icon().getAttribute('aria-expanded')).toBe('false');
  });

  it('R28 a click elsewhere does not close the popover, so the camera can be dragged while values are adjusted; Escape closes it', async () => {
    setup();
    await userEvent.click(icon());
    await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }));
    fireEvent.pointerDown(document.body);
    expect(popover()).toBeTruthy();
    expect(icon().getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(popover()).toBeNull();
    expect(icon().getAttribute('aria-expanded')).toBe('false');
  });

  it('R40 the options are the Mask overlay switch and the Overlay opacity slider', async () => {
    setup({ overlay: true, opacity: 0.25 });
    await userEvent.click(icon());
    expect((screen.getByRole('switch', { name: 'Mask overlay' }) as HTMLInputElement).checked).toBe(true);
    const slider = screen.getByRole('slider', { name: 'Overlay opacity' }) as HTMLInputElement;
    expect(Number(slider.value)).toBe(0.25);
    expect([slider.min, slider.max, slider.step]).toEqual(['0', '1', '0.01']);
  });

  it('R40 the switch and the slider report their changes', async () => {
    const props = setup();
    await userEvent.click(icon());
    await userEvent.click(screen.getByRole('switch', { name: 'Mask overlay' }));
    expect(props.onOverlayChange).toHaveBeenCalledWith(true);
    fireEvent.change(screen.getByRole('slider', { name: 'Overlay opacity' }), { target: { value: '0.8' } });
    expect(props.onOpacityChange).toHaveBeenCalledWith(0.8);
  });

  it('R49 the popover holds the switch, then the opacity slider directly under it, then the Material Masks controls', async () => {
    setup({ controls: <p data-testid="masks-controls">controls</p> });
    await userEvent.click(icon());
    const toggle = screen.getByRole('switch', { name: 'Mask overlay' });
    const opacity = screen.getByRole('slider', { name: 'Overlay opacity' });
    const controls = screen.getByTestId('masks-controls');
    const follows = (a: Node, b: Node): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(follows(toggle, opacity)).toBe(true);
    expect(follows(opacity, controls)).toBe(true);
    expect(popover()?.contains(controls)).toBe(true);
  });

  it('R49 the controls are built only while the popover is open', async () => {
    setup({ controls: <p data-testid="masks-controls">controls</p> });
    expect(screen.queryByTestId('masks-controls')).toBeNull();
    await userEvent.click(icon());
    expect(screen.getByTestId('masks-controls')).toBeTruthy();
    await userEvent.click(icon());
    expect(screen.queryByTestId('masks-controls')).toBeNull();
  });

  it('R18 R49 with no labels the switch is disabled and says why, and the controls are not offered', async () => {
    setup({ hasLabels: false, controls: <p data-testid="masks-controls">controls</p> });
    await userEvent.click(icon());
    const toggle = screen.getByRole('switch', { name: 'Mask overlay' }) as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.closest('label')?.getAttribute('title')).toBe('There are no masks yet. Generate the material first.');
    expect(screen.getByRole('slider', { name: 'Overlay opacity' })).toBeTruthy();
    expect(screen.queryByTestId('masks-controls')).toBeNull();
  });

  it('R28 Escape closes the popover and the icon goes inactive; the next click opens it again', async () => {
    setup();
    await userEvent.click(icon());
    await userEvent.keyboard('{Escape}');
    expect(popover()).toBeNull();
    expect(icon().getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(icon());
    expect(popover()).toBeTruthy();
    expect(icon().getAttribute('aria-expanded')).toBe('true');
  });

  it('R28 Escape closes the popover and the icon goes inactive; one click on the icon opens it again', async () => {
    setup();
    await userEvent.click(icon());
    await userEvent.keyboard('{Escape}');
    expect(popover()).toBeNull();
    expect(icon().getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(icon());
    expect(popover()).toBeTruthy();
  });

  it('R28 the popover scrolls inside itself: its stylesheet bounds the height and scrolls the overflow, so a tall list never makes the app shell scroll', () => {
    expect(styles).toMatch(/max-height:\s*calc\(100vh/);
    expect(styles).toMatch(/overflow-y:\s*auto/);
  });
});
