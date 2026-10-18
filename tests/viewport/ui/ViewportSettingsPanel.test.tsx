// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewportSettingsPanel } from '../../../src/viewport/ui/ViewportSettingsPanel';
import { DEFAULT_VIEWPORT_SETTINGS, type ViewportSettings } from '../../../src/viewport/viewportSettings';

afterEach(cleanup);

const panel = (settings: ViewportSettings = DEFAULT_VIEWPORT_SETTINGS, onChange: (patch: Partial<ViewportSettings>) => void = () => undefined) => render(<ViewportSettingsPanel settings={settings} onChange={onChange} />);

describe('ViewportSettingsPanel', () => {
  it('R14 it lists HDRI, light intensity and rotation, auto-rotate, background, wireframe and the four metal and rough sliders', () => {
    panel();
    expect(screen.getByRole('combobox', { name: 'HDRI' }).textContent).toContain('Studio (built-in)');
    for (const name of ['Light intensity', 'Light rotation', 'Metal strength', 'Metal contrast', 'Rough strength', 'Rough contrast']) {
      expect(screen.getByRole('slider', { name })).toBeTruthy();
    }
    for (const name of ['Auto-rotate', 'Background', 'Wireframe']) {
      expect(screen.getByRole('switch', { name })).toBeTruthy();
    }
  });

  it('R14 each control shows its current value', () => {
    panel({ ...DEFAULT_VIEWPORT_SETTINGS, environmentIntensity: 1.5, environmentRotationDeg: 90, wireframe: true, mapAdjust: { metalStrength: 2, metalContrast: 0.5, roughStrength: 1, roughContrast: 1 } });
    expect(screen.getByText('1.50')).toBeTruthy();
    expect(screen.getByText('90°')).toBeTruthy();
    expect((screen.getByRole('slider', { name: 'Metal strength' }) as HTMLInputElement).value).toBe('2');
    expect(screen.getByRole('switch', { name: 'Wireframe' }).getAttribute('aria-checked')).toBe('true');
  });

  it('R14 moving a slider reports only that setting', () => {
    const onChange = vi.fn();
    panel(DEFAULT_VIEWPORT_SETTINGS, onChange);
    fireEvent.change(screen.getByRole('slider', { name: 'Light intensity' }), { target: { value: '2' } });
    expect(onChange).toHaveBeenLastCalledWith({ environmentIntensity: 2 });
    fireEvent.change(screen.getByRole('slider', { name: 'Light rotation' }), { target: { value: '120' } });
    expect(onChange).toHaveBeenLastCalledWith({ environmentRotationDeg: 120 });
  });

  it('R14 a metal or rough slider reports the whole adjustment with that value changed', () => {
    const onChange = vi.fn();
    panel(DEFAULT_VIEWPORT_SETTINGS, onChange);
    fireEvent.change(screen.getByRole('slider', { name: 'Rough contrast' }), { target: { value: '2.5' } });
    expect(onChange).toHaveBeenLastCalledWith({ mapAdjust: { ...DEFAULT_VIEWPORT_SETTINGS.mapAdjust, roughContrast: 2.5 } });
  });

  it('R14 the switches report their new value', async () => {
    const onChange = vi.fn();
    panel(DEFAULT_VIEWPORT_SETTINGS, onChange);
    await userEvent.click(screen.getByRole('switch', { name: 'Wireframe' }));
    expect(onChange).toHaveBeenLastCalledWith({ wireframe: true });
    await userEvent.click(screen.getByRole('switch', { name: 'Auto-rotate' }));
    expect(onChange).toHaveBeenLastCalledWith({ autoRotate: true });
  });

  it('R14 choosing an HDRI from the list reports its id', async () => {
    const onChange = vi.fn();
    panel(DEFAULT_VIEWPORT_SETTINGS, onChange);
    await userEvent.click(screen.getByRole('combobox', { name: 'HDRI' }));
    await userEvent.click(screen.getByRole('option', { name: 'Venice sunset' }));
    expect(onChange).toHaveBeenLastCalledWith({ hdri: 'venice_sunset' });
  });

  it('R14 the background switch is unavailable for the built-in studio, with the reason, and available for a file HDRI', () => {
    const { unmount } = panel();
    const studioSwitch = screen.getByRole('switch', { name: 'Background' }) as HTMLInputElement;
    expect(studioSwitch.disabled).toBe(true);
    expect(screen.getByText('Background').closest('label')!.getAttribute('title')).toBe('The built-in studio has no backdrop');
    unmount();
    panel({ ...DEFAULT_VIEWPORT_SETTINGS, hdri: 'venice_sunset' });
    expect((screen.getByRole('switch', { name: 'Background' }) as HTMLInputElement).disabled).toBe(false);
  });

  it('R14 while auto-rotate is on the rotation slider is unavailable because the light is turning', () => {
    panel({ ...DEFAULT_VIEWPORT_SETTINGS, autoRotate: true });
    expect((screen.getByRole('slider', { name: 'Light rotation' }) as HTMLInputElement).disabled).toBe(true);
  });
});
