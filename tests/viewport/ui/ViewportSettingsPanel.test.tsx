// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewportSettingsPanel } from '../../../src/viewport/ui/ViewportSettingsPanel';
import { describeTooltipOf } from '../../support/tooltipDescription';
import { DEFAULT_VIEWPORT_SETTINGS, type ViewportSettings } from '../../../src/viewport/viewportSettings';

afterEach(cleanup);

const panel = (settings: ViewportSettings = DEFAULT_VIEWPORT_SETTINGS, onChange: (patch: Partial<ViewportSettings>) => void = () => undefined) => render(<ViewportSettingsPanel settings={settings} onChange={onChange} />);
const group = (name: string) => within(screen.getByRole('group', { name }));

describe('ViewportSettingsPanel', () => {
  it('R14 it has the headings Environment, Material and View, and the subheadings Light, HDRI, Metal, Roughness, Normal, Shading and Mesh', () => {
    panel();
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Environment', 'Material', 'View']);
    expect(screen.getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)).toEqual(['Light', 'HDRI', 'Metal', 'Roughness', 'Normal', 'Shading', 'Mesh']);
    for (const name of ['Light', 'HDRI', 'Metal', 'Roughness', 'Normal', 'Shading', 'Mesh']) expect(screen.getByRole('group', { name })).toBeTruthy();
  });

  it('R14c the controls of a subsection sit in an indented rows column and the subheading does not', () => {
    panel();
    const light = screen.getByRole('group', { name: 'Light' });
    const rows = light.querySelector('.viewport-settings__rows');
    expect(rows).not.toBeNull();
    expect(rows?.contains(within(light).getByRole('slider', { name: 'Intensity' }))).toBe(true);
    expect(rows?.contains(within(light).getByRole('heading', { level: 4 }))).toBe(false);
  });

  it('materialgen preview R31 a list of section ids hides those sections and nothing else', () => {
    render(<ViewportSettingsPanel settings={DEFAULT_VIEWPORT_SETTINGS} onChange={() => undefined} hiddenSections={['view']} />);
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Environment', 'Material']);
    expect(screen.queryByRole('group', { name: 'Shading' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Mesh' })).toBeNull();
  });

  it('materialgen preview R42 extra material subsections show under Normal, inside the Material section', () => {
    render(<ViewportSettingsPanel settings={DEFAULT_VIEWPORT_SETTINGS} onChange={() => undefined} hiddenSections={['view']} materialExtras={<p>extra controls</p>} />);
    const material = screen.getByRole('heading', { level: 3, name: 'Material' }).parentElement!;
    expect(within(material).getByText('extra controls')).toBeTruthy();
    expect(within(material).getByRole('group', { name: 'Normal' }).compareDocumentPosition(within(material).getByText('extra controls')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it('R14 Metal, Roughness and Normal each hold a Strength and a Contrast slider', () => {
    panel();
    for (const name of ['Metal', 'Roughness', 'Normal']) {
      expect(group(name).getByRole('slider', { name: 'Strength' })).toBeTruthy();
      expect(group(name).getByRole('slider', { name: 'Contrast' })).toBeTruthy();
    }
  });

  it('R14 no slider or switch label repeats Light, Metal or Rough, and each slider row reads label, track, value', () => {
    panel();
    const names = [...screen.getAllByRole('slider'), ...screen.getAllByRole('switch')].map((control) => control.getAttribute('aria-label') ?? control.closest('label')?.textContent ?? '');
    expect(names.length).toBeGreaterThan(8);
    for (const name of names) expect(name).not.toMatch(/light|metal|rough|normal/i);
    for (const slider of screen.getAllByRole('slider')) {
      const row = slider.closest('.ui-slider');
      expect(row?.getAttribute('data-layout')).toBe('row');
      expect(row?.querySelector('.ui-slider__label')?.textContent).toBe(slider.getAttribute('aria-label'));
    }
  });

  it('R14 each control shows its current value', () => {
    panel({ ...DEFAULT_VIEWPORT_SETTINGS, environmentIntensity: 1.5, environmentRotationDeg: 90, wireframe: true, mapAdjust: { metalStrength: 2, metalContrast: 0.5, roughStrength: 1, roughContrast: 1, normalStrength: 1.75, normalContrast: 0.25 } });
    expect(screen.getByText('1.50')).toBeTruthy();
    expect(screen.getByText('90°')).toBeTruthy();
    expect((group('Normal').getByRole('slider', { name: 'Strength' }) as HTMLInputElement).value).toBe('1.75');
    expect((group('Normal').getByRole('slider', { name: 'Contrast' }) as HTMLInputElement).value).toBe('0.25');
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

  it('R14 a Metal, Roughness or Normal slider reports the whole adjustment with that value changed', () => {
    const onChange = vi.fn();
    panel(DEFAULT_VIEWPORT_SETTINGS, onChange);
    fireEvent.change(group('Normal').getByRole('slider', { name: 'Strength' }), { target: { value: '2' } });
    expect(onChange).toHaveBeenLastCalledWith({ mapAdjust: { ...DEFAULT_VIEWPORT_SETTINGS.mapAdjust, normalStrength: 2 } });
    fireEvent.change(group('Normal').getByRole('slider', { name: 'Contrast' }), { target: { value: '0.5' } });
    expect(onChange).toHaveBeenLastCalledWith({ mapAdjust: { ...DEFAULT_VIEWPORT_SETTINGS.mapAdjust, normalContrast: 0.5 } });
    fireEvent.change(group('Roughness').getByRole('slider', { name: 'Contrast' }), { target: { value: '2.5' } });
    expect(onChange).toHaveBeenLastCalledWith({ mapAdjust: { ...DEFAULT_VIEWPORT_SETTINGS.mapAdjust, roughContrast: 2.5 } });
    fireEvent.change(group('Metal').getByRole('slider', { name: 'Strength' }), { target: { value: '1.5' } });
    expect(onChange).toHaveBeenLastCalledWith({ mapAdjust: { ...DEFAULT_VIEWPORT_SETTINGS.mapAdjust, metalStrength: 1.5 } });
  });

  it('R14b Light Intensity and Rotation, the Metal, Roughness and Normal sliders and the Angle each have a Reset arrow that sets the default', () => {
    const onChange = vi.fn();
    const moved = { metalStrength: 2, metalContrast: 2, roughStrength: 2, roughContrast: 2, normalStrength: 2, normalContrast: 2 };
    panel({ ...DEFAULT_VIEWPORT_SETTINGS, environmentIntensity: 2.5, environmentRotationDeg: 90, smoothAngleDeg: 40, mapAdjust: moved }, onChange);
    const defaults = DEFAULT_VIEWPORT_SETTINGS;
    fireEvent.click(group('Light').getByRole('button', { name: 'Reset Intensity' }));
    expect(onChange).toHaveBeenLastCalledWith({ environmentIntensity: defaults.environmentIntensity });
    fireEvent.click(group('Light').getByRole('button', { name: 'Reset Rotation' }));
    expect(onChange).toHaveBeenLastCalledWith({ environmentRotationDeg: defaults.environmentRotationDeg });
    fireEvent.click(group('Shading').getByRole('button', { name: 'Reset Angle' }));
    expect(onChange).toHaveBeenLastCalledWith({ smoothAngleDeg: defaults.smoothAngleDeg });
    fireEvent.click(group('Normal').getByRole('button', { name: 'Reset Contrast' }));
    expect(onChange).toHaveBeenLastCalledWith({ mapAdjust: { ...moved, normalContrast: defaults.mapAdjust.normalContrast } });
    fireEvent.click(group('Metal').getByRole('button', { name: 'Reset Strength' }));
    expect(onChange).toHaveBeenLastCalledWith({ mapAdjust: { ...moved, metalStrength: defaults.mapAdjust.metalStrength } });
  });

  it('R14b a Reset arrow is disabled at the default, there is none for a switch, the dropdown or the Smooth | Flat choice, and it is disabled with its slider', () => {
    const { unmount } = panel();
    const resets = screen.getAllByRole('button').filter((button) => /^Reset /.test(button.getAttribute('aria-label') ?? ''));
    expect(resets).toHaveLength(9); // Intensity, Rotation, six Metal/Roughness/Normal sliders, Angle
    for (const reset of resets) expect((reset as HTMLButtonElement).disabled).toBe(true);
    unmount();
    panel({ ...DEFAULT_VIEWPORT_SETTINGS, autoRotate: true, environmentRotationDeg: 90 });
    expect((group('Light').getByRole('button', { name: 'Reset Rotation' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('R14 the switches report their new value', async () => {
    const onChange = vi.fn();
    panel(DEFAULT_VIEWPORT_SETTINGS, onChange);
    await userEvent.click(screen.getByRole('switch', { name: 'Wireframe' }));
    expect(onChange).toHaveBeenLastCalledWith({ wireframe: true });
    await userEvent.click(screen.getByRole('switch', { name: 'Auto rotate' }));
    expect(onChange).toHaveBeenLastCalledWith({ autoRotate: true });
  });

  it('R24 the popover has no Grid switch: the corner button is the only control for the grid', () => {
    panel(DEFAULT_VIEWPORT_SETTINGS, vi.fn());
    expect(screen.queryByRole('switch', { name: 'Grid' })).toBeNull();
    expect(screen.getByRole('switch', { name: 'Wireframe' })).toBeTruthy();
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
    expect(describeTooltipOf(studioSwitch)).toBe('Background. The built-in studio has no backdrop.');
    unmount();
    panel({ ...DEFAULT_VIEWPORT_SETTINGS, hdri: 'venice_sunset' });
    expect((screen.getByRole('switch', { name: 'Background' }) as HTMLInputElement).disabled).toBe(false);
  });

  it('R14 while auto-rotate is on the rotation slider is unavailable because the light is turning', () => {
    panel({ ...DEFAULT_VIEWPORT_SETTINGS, autoRotate: true });
    expect((group('Light').getByRole('slider', { name: 'Rotation' }) as HTMLInputElement).disabled).toBe(true);
  });
});
