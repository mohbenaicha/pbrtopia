// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaskDisplayControl } from '../../../../src/materialgen/preview/ui/MaskDisplayControl';

afterEach(cleanup);

type Props = Parameters<typeof MaskDisplayControl>[0];
/** Stands in for the app: it keeps the panel's open state, as MaskView does, and passes it back. */
function WithPanelState({ initialPanelOpen, ...props }: Omit<Props, 'panelOpen'> & { initialPanelOpen: boolean }): React.JSX.Element {
  const [panelOpen, setPanelOpen] = useState(initialPanelOpen);
  return (
    <>
      <MaskDisplayControl {...props} panelOpen={panelOpen} onPanelOpenChange={(open) => { setPanelOpen(open); props.onPanelOpenChange(open); }} />
      <button type="button" onClick={() => setPanelOpen((open) => !open)}>panel header</button>
    </>
  );
}
const setup = (patch: Partial<Omit<Props, 'panelOpen'>> & { initialPanelOpen?: boolean } = {}) => {
  const { initialPanelOpen = false, ...rest } = patch;
  const props = { hasLabels: true, overlay: false, onOverlayChange: vi.fn(), opacity: 0.5, onOpacityChange: vi.fn(), onPanelOpenChange: vi.fn(), ...rest };
  render(<WithPanelState {...props} initialPanelOpen={initialPanelOpen} />);
  return props;
};
const icon = () => screen.getByRole('button', { name: 'Material Masks' });

describe('materialgen/preview R28 R40 the Material Masks icon', () => {
  it('R28 the icon is always enabled and named Material Masks, also with no labels', () => {
    setup({ hasLabels: false });
    expect((icon() as HTMLButtonElement).disabled).toBe(false);
    expect(icon().getAttribute('data-testid')).toBe('preview-masks');
  });

  it('R28 a click opens the Material Masks panel and shows the display options; a second click closes them', async () => {
    const props = setup();
    await userEvent.click(icon());
    expect(props.onPanelOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('dialog', { name: 'Mask display' })).toBeTruthy();
    expect(icon().getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(icon());
    expect(props.onPanelOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('dialog', { name: 'Mask display' })).toBeNull();
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

  it('R18 with no labels the switch is disabled and says why', async () => {
    setup({ hasLabels: false });
    await userEvent.click(icon());
    const toggle = screen.getByRole('switch', { name: 'Mask overlay' }) as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.closest('label')?.getAttribute('title')).toBe('There are no masks yet. Create them in Material Masks.');
  });

  it('R28 Escape closes the options and the icon goes inactive, the panel stays open, and the next click opens the options again', async () => {
    const props = setup();
    await userEvent.click(icon());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Mask display' })).toBeNull();
    expect(icon().getAttribute('aria-expanded')).toBe('false');
    expect(props.onPanelOpenChange).toHaveBeenCalledTimes(1); // the panel was not asked to close
    await userEvent.click(icon());
    expect(screen.getByRole('dialog', { name: 'Mask display' })).toBeTruthy();
    expect(icon().getAttribute('aria-expanded')).toBe('true');
  });

  it('R28 a click elsewhere closes the options and the icon goes inactive; one click on the icon opens them again', async () => {
    setup();
    await userEvent.click(icon());
    await userEvent.click(screen.getByRole('button', { name: 'panel header' }));
    expect(screen.queryByRole('dialog', { name: 'Mask display' })).toBeNull();
    expect(icon().getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(icon());
    expect(screen.getByRole('dialog', { name: 'Mask display' })).toBeTruthy();
    expect(icon().getAttribute('aria-expanded')).toBe('true');
  });

  it('R28 closing the panel from its own header closes the options and the icon goes inactive', async () => {
    setup();
    await userEvent.click(icon());
    fireEvent.click(screen.getByRole('button', { name: 'panel header' })); // flips the panel to closed without a pointer-down outside
    expect(screen.queryByRole('dialog', { name: 'Mask display' })).toBeNull();
    expect(icon().getAttribute('aria-expanded')).toBe('false');
  });

  it('R28 with the panel already open from its own header the icon is inactive and one click opens the options', async () => {
    setup({ initialPanelOpen: true });
    expect(icon().getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(icon());
    expect(screen.getByRole('dialog', { name: 'Mask display' })).toBeTruthy();
  });
});
