// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VIEWPORT_SETTINGS } from '@shared/viewport';
import { DEFAULT_PREVIEW_PREFS, DEFAULT_PREVIEW_VALUES } from '@mat/storage';
import { PreviewSettingsPanel } from '../../../../src/materialgen/preview/ui/PreviewSettingsPanel';

afterEach(cleanup);

function setup() {
  const onChange = vi.fn();
  const onValuesChange = vi.fn();
  const onPrefsChange = vi.fn();
  const onReset = vi.fn();
  render(
    <PreviewSettingsPanel settings={DEFAULT_VIEWPORT_SETTINGS} onChange={onChange} values={DEFAULT_PREVIEW_VALUES} onValuesChange={onValuesChange} prefs={DEFAULT_PREVIEW_PREFS} onPrefsChange={onPrefsChange} onReset={onReset} />,
  );
  return { onChange, onValuesChange, onPrefsChange, onReset };
}
const group = (name: string) => within(screen.getByRole('group', { name }));

describe('materialgen/preview R42 R29 the gear popover', () => {
  it('R42 keeps Environment and Material, adds Height, Occlusion, Tiling and Mesh under Material, and has no View section', () => {
    setup();
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Environment', 'Material']);
    expect(screen.getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)).toEqual(['Light', 'HDRI', 'Metal', 'Roughness', 'Normal', 'Height', 'Occlusion', 'Tiling', 'Mesh']);
    expect(screen.queryByRole('radio', { name: 'Smooth' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Wireframe' })).toBeNull();
  });

  it('R42 labels never repeat the subheading word', () => {
    setup();
    expect(group('Height').getAllByRole('slider').map((slider) => slider.getAttribute('aria-label'))).toEqual(['Scale', 'Level', 'Contrast']);
    expect(group('Occlusion').getByRole('slider', { name: 'Intensity' })).toBeTruthy();
    expect(group('Tiling').getAllByRole('slider').map((slider) => slider.getAttribute('aria-label'))).toEqual(['X', 'Y']);
    expect(group('Mesh').getByRole('slider', { name: 'Resolution' })).toBeTruthy();
  });

  it('R35 R36 the Height sliders have their ranges and steps', () => {
    setup();
    const [scale, level, contrast] = group('Height').getAllByRole('slider') as HTMLInputElement[];
    expect([scale!.min, scale!.max, scale!.step, scale!.value]).toEqual(['0', '0.1', '0.001', '0.02']);
    expect([level!.min, level!.max, level!.step, level!.value]).toEqual(['0', '1', '0.01', '0.5']);
    expect([contrast!.min, contrast!.max, contrast!.step, contrast!.value]).toEqual(['0', '3', '0.01', '1']);
  });

  it('R34 R37 Tiling is 1 to 10 in whole steps, Occlusion Intensity 0 to 2', () => {
    setup();
    const [x, y] = group('Tiling').getAllByRole('slider') as HTMLInputElement[];
    expect([x!.min, x!.max, x!.step, y!.min, y!.max, y!.step]).toEqual(['1', '10', '1', '1', '10', '1']);
    const intensity = group('Occlusion').getByRole('slider', { name: 'Intensity' }) as HTMLInputElement;
    expect([intensity.min, intensity.max, intensity.step]).toEqual(['0', '2', '0.01']);
  });

  it('R34 changing Tiling X changes only X', () => {
    const { onValuesChange } = setup();
    fireEvent.change(group('Tiling').getByRole('slider', { name: 'X' }), { target: { value: '4' } });
    expect(onValuesChange).toHaveBeenCalledWith({ tilingX: 4 });
  });

  it('R35 R36 the Height sliders change the project values', () => {
    const { onValuesChange } = setup();
    fireEvent.change(group('Height').getByRole('slider', { name: 'Scale' }), { target: { value: '0.05' } });
    fireEvent.change(group('Height').getByRole('slider', { name: 'Level' }), { target: { value: '0.3' } });
    fireEvent.change(group('Height').getByRole('slider', { name: 'Contrast' }), { target: { value: '2' } });
    expect(onValuesChange.mock.calls).toEqual([[{ heightScale: 0.05 }], [{ heightLevel: 0.3 }], [{ heightContrast: 2 }]]);
  });

  it('R37 Occlusion Intensity changes the app-wide pref', () => {
    const { onPrefsChange } = setup();
    fireEvent.change(group('Occlusion').getByRole('slider', { name: 'Intensity' }), { target: { value: '1.5' } });
    expect(onPrefsChange).toHaveBeenCalledWith({ aoIntensity: 1.5 });
  });

  it('R39 the Resolution is applied when the slider is released, not on every move', () => {
    const { onPrefsChange } = setup();
    const slider = group('Mesh').getByRole('slider', { name: 'Resolution' });
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '3' } });
    fireEvent.change(slider, { target: { value: '4' } });
    expect(onPrefsChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(window);
    expect(onPrefsChange).toHaveBeenCalledTimes(1);
    expect(onPrefsChange).toHaveBeenCalledWith({ meshResolution: 4 });
  });

  it('R39 the readout names the segments per side', () => {
    setup();
    expect(group('Mesh').getByText('256')).toBeTruthy();
  });

  it('R41 Reset to defaults asks for the one combined reset', async () => {
    const { onReset } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('R60 the Normal subsection has a label-less Normal direction dropdown with OpenGL and DirectX, under the Strength and Contrast sliders', async () => {
    const { onPrefsChange } = setup();
    const normal = group('Normal');
    const box = normal.getByRole('combobox', { name: 'Normal direction' });
    expect(box.textContent).toContain('OpenGL');
    expect(normal.queryByText('Normal direction')?.getAttribute('data-hidden')).toBe(''); // the label is not drawn
    const contrast = normal.getByRole('slider', { name: 'Contrast' });
    expect(contrast.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(box);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['OpenGL', 'DirectX']);
    await userEvent.click(screen.getByRole('option', { name: 'DirectX' }));
    expect(onPrefsChange).toHaveBeenCalledWith({ normalDirection: 'directx' });
  });

  it('R61 every slider has a Reset arrow, disabled at its default, and no toggle or dropdown has one', () => {
    setup();
    for (const [name, labels] of [['Light', ['Intensity', 'Rotation']], ['Metal', ['Strength', 'Contrast']], ['Roughness', ['Strength', 'Contrast']], ['Normal', ['Strength', 'Contrast']], ['Height', ['Scale', 'Level', 'Contrast']], ['Occlusion', ['Intensity']], ['Tiling', ['X', 'Y']], ['Mesh', ['Resolution']]] as const) {
      for (const label of labels) expect((group(name).getByRole('button', { name: `Reset ${label}` }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getAllByRole('button').filter((button) => /^Reset /.test(button.getAttribute('aria-label') ?? '') && button.getAttribute('aria-label') !== 'Reset to defaults')).toHaveLength(15);
  });

  it('R61 Height Scale at 0.08 resets to 0.02, and Normal Strength resets to its viewport default', () => {
    const onValuesChange = vi.fn();
    const onChange = vi.fn();
    render(
      <PreviewSettingsPanel
        settings={{ ...DEFAULT_VIEWPORT_SETTINGS, mapAdjust: { ...DEFAULT_VIEWPORT_SETTINGS.mapAdjust, normalStrength: 2 } }}
        onChange={onChange}
        values={{ ...DEFAULT_PREVIEW_VALUES, heightScale: 0.08 }}
        onValuesChange={onValuesChange}
        prefs={{ ...DEFAULT_PREVIEW_PREFS, aoIntensity: 0.3, meshResolution: 4 }}
        onPrefsChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    fireEvent.click(group('Height').getByRole('button', { name: 'Reset Scale' }));
    expect(onValuesChange).toHaveBeenCalledWith({ heightScale: 0.02 });
    fireEvent.click(group('Normal').getByRole('button', { name: 'Reset Strength' }));
    expect(onChange).toHaveBeenCalledWith({ mapAdjust: { ...DEFAULT_VIEWPORT_SETTINGS.mapAdjust, normalStrength: DEFAULT_VIEWPORT_SETTINGS.mapAdjust.normalStrength } });
  });

  it('R61 the Occlusion and Mesh resets set the app-wide defaults', () => {
    const onPrefsChange = vi.fn();
    render(
      <PreviewSettingsPanel settings={DEFAULT_VIEWPORT_SETTINGS} onChange={vi.fn()} values={DEFAULT_PREVIEW_VALUES} onValuesChange={vi.fn()} prefs={{ ...DEFAULT_PREVIEW_PREFS, aoIntensity: 0.3, meshResolution: 4 }} onPrefsChange={onPrefsChange} onReset={vi.fn()} />,
    );
    fireEvent.click(group('Occlusion').getByRole('button', { name: 'Reset Intensity' }));
    expect(onPrefsChange).toHaveBeenLastCalledWith({ aoIntensity: DEFAULT_PREVIEW_PREFS.aoIntensity });
    fireEvent.click(group('Mesh').getByRole('button', { name: 'Reset Resolution' }));
    expect(onPrefsChange).toHaveBeenLastCalledWith({ meshResolution: DEFAULT_PREVIEW_PREFS.meshResolution });
  });

  it('R44 the existing controls still change the viewport settings', () => {
    const { onChange } = setup();
    fireEvent.change(group('Light').getByRole('slider', { name: 'Intensity' }), { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith({ environmentIntensity: 2 });
  });
});
