// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewportSettingsPanel } from '../../../src/viewport/ui/ViewportSettingsPanel';
import { DEFAULT_VIEWPORT_SETTINGS, type ViewportSettings } from '../../../src/viewport/viewportSettings';

afterEach(cleanup);

const panel = (settings: ViewportSettings = DEFAULT_VIEWPORT_SETTINGS, onChange: (patch: Partial<ViewportSettings>) => void = () => undefined) => render(<ViewportSettingsPanel settings={settings} onChange={onChange} />);
const group = (name: string) => within(screen.getByRole('group', { name }));

describe('ViewportSettingsPanel', () => {
  it('R14 it has the headings Environment, Material and View, and the subheadings Light, HDRI, Metal, Roughness, Shading and Mesh', () => {
    panel();
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Environment', 'Material', 'View']);
    expect(screen.getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)).toEqual(['Light', 'HDRI', 'Metal', 'Roughness', 'Shading', 'Mesh']);
    for (const name of ['Light', 'HDRI', 'Metal', 'Roughness', 'Shading', 'Mesh']) expect(screen.getByRole('group', { name })).toBeTruthy();
  });

  it('R14 Shading holds the Smooth | Flat choice (Smooth by default) and the Angle slider, which reads Off at 180; Mesh holds Wireframe', () => {
    panel();
    const shading = group('Shading');
    expect(shading.getByRole('radio', { name: 'Smooth' }).getAttribute('aria-checked')).toBe('true');
    expect(shading.getByRole('radio', { name: 'Flat' }).getAttribute('aria-checked')).toBe('false');
    const angle = shading.getByRole('slider', { name: 'Angle' }) as HTMLInputElement;
    expect([angle.min, angle.max, angle.step, angle.value]).toEqual(['0', '180', '1', '180']);
    expect(shading.getByText('Off')).toBeTruthy();
    expect(group('Mesh').getByRole('switch', { name: 'Wireframe' })).toBeTruthy();
  });

  it('R14 the Angle shows degrees below 180, reports its change, and is unavailable while Flat', () => {
    const onChange = vi.fn();
    const { unmount } = panel({ ...DEFAULT_VIEWPORT_SETTINGS, smoothAngleDeg: 35 }, onChange);
    expect(group('Shading').getByText('35°')).toBeTruthy();
    expect((group('Shading').getByRole('slider', { name: 'Angle' }) as HTMLInputElement).disabled).toBe(false);
    fireEvent.change(group('Shading').getByRole('slider', { name: 'Angle' }), { target: { value: '60' } });
    expect(onChange).toHaveBeenLastCalledWith({ smoothAngleDeg: 60 });
    unmount();
    panel({ ...DEFAULT_VIEWPORT_SETTINGS, flatShading: true });
    expect(group('Shading').getByRole('radio', { name: 'Flat' }).getAttribute('aria-checked')).toBe('true');
    expect((group('Shading').getByRole('slider', { name: 'Angle' }) as HTMLInputElement).disabled).toBe(true);
  });

  it('R14 choosing Flat or Smooth reports flatShading', async () => {
    const onChange = vi.fn();
    panel(DEFAULT_VIEWPORT_SETTINGS, onChange);
    await userEvent.click(group('Shading').getByRole('radio', { name: 'Flat' }));
    expect(onChange).toHaveBeenLastCalledWith({ flatShading: true });
    cleanup();
    panel({ ...DEFAULT_VIEWPORT_SETTINGS, flatShading: true }, onChange);
    await userEvent.click(group('Shading').getByRole('radio', { name: 'Smooth' }));
    expect(onChange).toHaveBeenLastCalledWith({ flatShading: false });
  });

  it('R14 Light holds Intensity, Rotation and Auto rotate; HDRI holds the Background switch and the dropdown', () => {
    panel();
    const light = group('Light');
    expect(light.getByRole('slider', { name: 'Intensity' })).toBeTruthy();
    expect(light.getByRole('slider', { name: 'Rotation' })).toBeTruthy();
    expect(light.getByRole('switch', { name: 'Auto rotate' })).toBeTruthy();
    const hdri = group('HDRI');
    expect(hdri.getByRole('switch', { name: 'Background' })).toBeTruthy();
    expect(hdri.getByRole('combobox', { name: 'HDRI' }).textContent).toContain('Studio (built-in)');
  });

  it('R14 Metal and Roughness each hold a Strength and a Contrast slider', () => {
    panel();
    for (const name of ['Metal', 'Roughness']) {
      expect(group(name).getByRole('slider', { name: 'Strength' })).toBeTruthy();
      expect(group(name).getByRole('slider', { name: 'Contrast' })).toBeTruthy();
    }
  });

  it('R14 no slider or switch label repeats Light, Metal or Rough, and each slider row reads label, track, value', () => {
    panel();
    const names = [...screen.getAllByRole('slider'), ...screen.getAllByRole('switch')].map((control) => control.getAttribute('aria-label') ?? control.closest('label')?.textContent ?? '');
    expect(names.length).toBeGreaterThan(8);
    for (const name of names) expect(name).not.toMatch(/light|metal|rough/i);
    for (const slider of screen.getAllByRole('slider')) {
      const row = slider.closest('.ui-slider');
      expect(row?.getAttribute('data-layout')).toBe('row');
      expect(row?.querySelector('.ui-slider__label')?.textContent).toBe(slider.getAttribute('aria-label'));
    }
  });

  it('R14 each control shows its current value', () => {
    panel({ ...DEFAULT_VIEWPORT_SETTINGS, environmentIntensity: 1.5, environmentRotationDeg: 90, wireframe: true, mapAdjust: { metalStrength: 2, metalContrast: 0.5, roughStrength: 1, roughContrast: 1 } });
    expect(screen.getByText('1.50')).toBeTruthy();
    expect(screen.getByText('90°')).toBeTruthy();
    expect((group('Metal').getByRole('slider', { name: 'Strength' }) as HTMLInputElement).value).toBe('2');
    expect((group('Metal').getByRole('slider', { name: 'Contrast' }) as HTMLInputElement).value).toBe('0.5');
    expect(screen.getByRole('switch', { name: 'Wireframe' }).getAttribute('aria-checked')).toBe('true');
  });

  it('R14 moving a slider reports only that setting', () => {
    const onChange = vi.fn();
    panel(DEFAULT_VIEWPORT_SETTINGS, onChange);
    fireEvent.change(group('Light').getByRole('slider', { name: 'Intensity' }), { target: { value: '2' } });
    expect(onChange).toHaveBeenLastCalledWith({ environmentIntensity: 2 });
    fireEvent.change(group('Light').getByRole('slider', { name: 'Rotation' }), { target: { value: '120' } });
    expect(onChange).toHaveBeenLastCalledWith({ environmentRotationDeg: 120 });
  });

  it('R14 a Metal or Roughness slider reports the whole adjustment with that value changed', () => {
    const onChange = vi.fn();
    panel(DEFAULT_VIEWPORT_SETTINGS, onChange);
    fireEvent.change(group('Roughness').getByRole('slider', { name: 'Contrast' }), { target: { value: '2.5' } });
    expect(onChange).toHaveBeenLastCalledWith({ mapAdjust: { ...DEFAULT_VIEWPORT_SETTINGS.mapAdjust, roughContrast: 2.5 } });
    fireEvent.change(group('Metal').getByRole('slider', { name: 'Strength' }), { target: { value: '1.5' } });
    expect(onChange).toHaveBeenLastCalledWith({ mapAdjust: { ...DEFAULT_VIEWPORT_SETTINGS.mapAdjust, metalStrength: 1.5 } });
  });

  it('R14 the switches report their new value', async () => {
    const onChange = vi.fn();
    panel(DEFAULT_VIEWPORT_SETTINGS, onChange);
    await userEvent.click(screen.getByRole('switch', { name: 'Wireframe' }));
    expect(onChange).toHaveBeenLastCalledWith({ wireframe: true });
    await userEvent.click(screen.getByRole('switch', { name: 'Auto rotate' }));
    expect(onChange).toHaveBeenLastCalledWith({ autoRotate: true });
  });

  it('R14 choosing an HDRI from the list reports its id', async () => {
    const onChange = vi.fn();
    panel(DEFAULT_VIEWPORT_SETTINGS, onChange);
    await userEvent.click(screen.getByRole('combobox', { name: 'HDRI' }));
    await userEvent.click(screen.getByRole('option', { name: 'Venice sunset' }));
    expect(onChange).toHaveBeenLastCalledWith({ hdri: 'venice_sunset' });
  });

  it('R14 the background switch is off by default, unavailable for the built-in studio with the reason, and available for a file HDRI', () => {
    const { unmount } = panel();
    const studioSwitch = screen.getByRole('switch', { name: 'Background' }) as HTMLInputElement;
    expect(studioSwitch.checked).toBe(false);
    expect(studioSwitch.disabled).toBe(true);
    expect(screen.getByText('Background').closest('label')!.getAttribute('title')).toBe('The built-in studio has no backdrop');
    unmount();
    panel({ ...DEFAULT_VIEWPORT_SETTINGS, hdri: 'venice_sunset' });
    expect((screen.getByRole('switch', { name: 'Background' }) as HTMLInputElement).disabled).toBe(false);
  });

  it('R14 while auto-rotate is on the rotation slider is unavailable because the light is turning', () => {
    panel({ ...DEFAULT_VIEWPORT_SETTINGS, autoRotate: true });
    expect((group('Light').getByRole('slider', { name: 'Rotation' }) as HTMLInputElement).disabled).toBe(true);
  });
});
