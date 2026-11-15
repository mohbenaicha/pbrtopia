// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEFT_PANEL_FLOOR, PANEL_MIN_PX, RANGE_READOUT_HIDE_PX, READOUT_HIDE_PX } from '@mat/compositing/ui/paintLayout';
import { Slider } from '@shared/ui-kit';
import { DEFAULT_BRUSH, type BrushControlKey, type BrushParams } from '@mat/compositing/plan/brushParams';
import { EMPTY_PALETTE, setMaterial, setShape, toggleActive } from '@mat/compositing/session/palette';
import { PaintToolPanel } from '@mat/compositing/ui/PaintToolPanel';
import { PAINT_TOOLTIPS } from '@mat/compositing/ui/paintTooltips';
import ballManifest from '../../../../src/materialgen/compositing/atlas/material_balls.json';

afterEach(cleanup);

const steel = { name: 'Steel', roughness: 0.4, metal: 1, rgb: [200, 100, 50] as const };

function renderPanel(brush: BrushParams = DEFAULT_BRUSH, palette = EMPTY_PALETTE) {
  const onBrushChange = vi.fn();
  const onPickShape = vi.fn();
  const onRemoveShape = vi.fn();
  const onToggleShapeActive = vi.fn();
  const view = render(
    <PaintToolPanel
      palette={palette}
      brush={brush}
      onBrushChange={onBrushChange}
      onPickShape={onPickShape}
      onToggleShapeActive={onToggleShapeActive}
      onRemoveShape={onRemoveShape}
      onToggleInvert={vi.fn()}
      onPickMaterial={vi.fn()}
      onRemoveMaterial={vi.fn()}
      canUndo={false}
      canRedo={false}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      notice={null}
      error={null}
      busy={false}
      onDone={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  return { onBrushChange, onPickShape, onRemoveShape, onToggleShapeActive, ...view };
}

const before = (first: Element, second: Element): boolean => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('materialgen/compositing paint panel, phase A (R42-R46)', () => {
  it('R42 the Material swatch comes first, and empty it is a grey sphere that can be clicked, not a plus', () => {
    renderPanel();
    const material = screen.getByTestId('palette-material');
    const shape1 = screen.getByTestId('palette-shape-1');
    expect(before(material, shape1)).toBe(true);
    expect(material.querySelector('.palette-swatches__ball--default')).not.toBeNull();
    expect(material.querySelector('[aria-label="Remove material"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose material' })).toBeTruthy();
  });

  it('R42 a chosen material replaces the grey sphere and has its remove mark', () => {
    renderPanel(DEFAULT_BRUSH, setMaterial(EMPTY_PALETTE, steel));
    const material = screen.getByTestId('palette-material');
    expect(material.querySelector('.palette-swatches__ball--default')).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove material' })).toBeTruthy();
  });

  it('R42 R54 a chosen material shows its cell of the baked sheet; a material the sheet does not know falls back to the flat colour circle', () => {
    renderPanel(DEFAULT_BRUSH, setMaterial(EMPTY_PALETTE, { ...steel, name: ballManifest.names[2]! }));
    const swatch = screen.getByTestId('palette-material');
    expect(swatch.querySelector('[data-ball-cell]')?.getAttribute('data-ball-cell')).toBe('2');
    expect(swatch.querySelector('.material-ball--flat')).toBeNull();
    cleanup();
    renderPanel(DEFAULT_BRUSH, setMaterial(EMPTY_PALETTE, { ...steel, name: 'Not in the sheet' }));
    const flat = screen.getByTestId('palette-material');
    expect(flat.querySelector('[data-ball-cell]')).toBeNull();
    expect(flat.querySelector('.material-ball--flat')).not.toBeNull();
  });

  it('R43 the panel no longer asks for a shape and a material', () => {
    renderPanel();
    expect(screen.queryByText(/pick a shape and a material/i)).toBeNull();
  });

  it('R41 the Material Masks note is gone', () => {
    renderPanel();
    expect(screen.queryByText(/later Material Masks change/i)).toBeNull();
  });

  it('R44 Height level and Additive are absent, not disabled, while Height is off, and back with their values when it is on', () => {
    const { rerender, onBrushChange } = renderPanel();
    expect(screen.queryByRole('slider', { name: 'Height level' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Additive' })).toBeNull();
    const on = { ...DEFAULT_BRUSH, height: { on: true, level: -0.4, additive: true } };
    rerender(
      <PaintToolPanel palette={EMPTY_PALETTE} brush={on} onBrushChange={onBrushChange} onPickShape={vi.fn()} onToggleShapeActive={vi.fn()} onRemoveShape={vi.fn()} onToggleInvert={vi.fn()} onPickMaterial={vi.fn()} onRemoveMaterial={vi.fn()} canUndo={false} canRedo={false} onUndo={vi.fn()} onRedo={vi.fn()} notice={null} error={null} busy={false} onDone={vi.fn()} onCancel={vi.fn()} />,
    );
    expect((screen.getByRole('slider', { name: 'Height level' }) as HTMLInputElement).value).toBe('-0.4');
    expect((screen.getByRole('switch', { name: 'Additive' }) as HTMLInputElement).checked).toBe(true);
  });

  it('R44 the Raise | Dent switch is absent while Edge burn is off', () => {
    renderPanel();
    expect(screen.queryByRole('switch', { name: 'Raise' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Dent' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Dent' })).toBeNull();
  });

  it('R45 with Edge burn on, one switch reads Raise and flips to Dent (and back) when toggled; there are no two buttons', () => {
    const on = { ...DEFAULT_BRUSH, edgeBurn: { ...DEFAULT_BRUSH.edgeBurn, on: true, direction: 'raise' as const } };
    const { onBrushChange } = renderPanel(on);
    fireEvent.click(screen.getByRole('switch', { name: 'Raise' }));
    expect(onBrushChange).toHaveBeenLastCalledWith({ ...on, edgeBurn: { ...on.edgeBurn, direction: 'dent' } });
    cleanup();
    const dent = { ...DEFAULT_BRUSH, edgeBurn: { ...DEFAULT_BRUSH.edgeBurn, on: true, direction: 'dent' as const } };
    const second = renderPanel(dent);
    expect(screen.getByRole('switch', { name: 'Dent' })).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'Dent' }));
    expect(second.onBrushChange).toHaveBeenLastCalledWith({ ...dent, edgeBurn: { ...dent.edgeBurn, direction: 'raise' } });
  });

  it('R77 the Burn width slider (1 to 10, a reset arrow, no dice) is drawn with Edge burn on, not with it off, and reports whole-texel changes', () => {
    renderPanel(DEFAULT_BRUSH);
    expect(screen.queryByRole('slider', { name: 'Burn width' })).toBeNull();
    cleanup();
    const on = { ...DEFAULT_BRUSH, edgeBurn: { ...DEFAULT_BRUSH.edgeBurn, on: true } };
    const { onBrushChange } = renderPanel(on);
    const slider = screen.getByRole('slider', { name: 'Burn width' }) as HTMLInputElement;
    expect([slider.min, slider.max, slider.step, slider.value]).toEqual(['1', '10', '1', '2']);
    expect(screen.queryByRole('button', { name: 'Random Burn width' })).toBeNull();
    fireEvent.change(slider, { target: { value: '6' } });
    expect(onBrushChange).toHaveBeenLastCalledWith({ ...on, edgeBurn: { ...on.edgeBurn, width: 6 } });
    cleanup();
    const wide = { ...on, edgeBurn: { ...on.edgeBurn, width: 6 } };
    const second = renderPanel(wide);
    fireEvent.click(screen.getByRole('button', { name: 'Reset Burn width' }));
    expect(second.onBrushChange).toHaveBeenLastCalledWith({ ...wide, edgeBurn: { ...wide.edgeBurn, width: 2 } });
  });

  it('R45 Undo and Redo come right after the swatches, before the brush controls', () => {
    renderPanel();
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(before(screen.getByTestId('palette-shape-3'), undo)).toBe(true);
    expect(before(undo, screen.getByRole('slider', { name: 'Size' }))).toBe(true);
  });

  it('R45 the switch rows use the dense row, as tall as a slider row', () => {
    renderPanel();
    expect(screen.getByRole('switch', { name: 'Height' }).closest('.ui-toggle')?.getAttribute('data-dense')).not.toBeNull();
  });

  it('R46 a Slider draws its muted marks and strong track only when asked', () => {
    const plain = render(<Slider label="A" value={0.5} min={0} max={1} onChange={() => {}} layout="row" />);
    expect(plain.container.querySelector('.ui-slider__marks')).toBeNull();
    plain.unmount();
    const marked = render(<Slider label="A" value={0.5} min={0} max={1} onChange={() => {}} layout="row" marks />);
    expect(marked.container.querySelectorAll('.ui-slider__mark')).toHaveLength(3);
    expect(marked.container.querySelector('.ui-slider')?.hasAttribute('data-marks')).toBe(true);
  });

  it('R46 the paint panel draws no marks on a single-value slider, and draws them on every range slider', () => {
    const on = { ...DEFAULT_BRUSH, height: { ...DEFAULT_BRUSH.height, on: true } };
    const single = renderPanel(on).container;
    const singles = single.querySelectorAll('.ui-slider');
    expect(singles.length).toBeGreaterThanOrEqual(6);
    singles.forEach((slider) => expect(slider.hasAttribute('data-marks')).toBe(false));
    expect(single.querySelectorAll('.ui-slider__mark')).toHaveLength(0);
    cleanup();
    const ranged = { ...on, size: { ...on.size, random: true }, rotation: { ...on.rotation, random: true } };
    const { container } = renderPanel(ranged);
    const ranges = container.querySelectorAll('.ui-range');
    expect(ranges).toHaveLength(2);
    ranges.forEach((range) => {
      const slider = range.closest('.ui-slider')!;
      expect(slider.hasAttribute('data-marks')).toBe(true);
      expect(slider.querySelectorAll('.ui-slider__mark')).toHaveLength(3);
    });
  });

  it('R47 the stylesheet hides the readouts below READOUT_HIDE_PX, and the left panel floor is PANEL_MIN_PX', () => {
    const css = readFileSync(resolve(__dirname, '../../../../src/materialgen/compositing/ui/paintPanel.css'), 'utf8');
    expect(css).toContain(`@container (max-width: ${READOUT_HIDE_PX}px)`);
    expect(css).toContain('.paint-panel .ui-slider__value');
    expect(css).toContain(`@container (max-width: ${RANGE_READOUT_HIDE_PX}px)`);
    expect(css).toContain(".paint-panel .ui-slider__value[data-range]");
    expect(RANGE_READOUT_HIDE_PX).toBeGreaterThan(READOUT_HIDE_PX);
    expect(LEFT_PANEL_FLOOR).toEqual({ left: PANEL_MIN_PX });
  });

  it('R49 every tooltip text has a heading and a sentence, and the keys are the panel controls', () => {
    const keys = Object.keys(PAINT_TOOLTIPS);
    for (const key of ['material', 'shape', 'invert', 'size', 'strength', 'hardness', 'distance', 'rotation', 'dice', 'height', 'heightLevel', 'additive', 'edgeBurn', 'raiseDent', 'undo', 'redo', 'done', 'cancel']) expect(keys).toContain(key);
    for (const words of Object.values(PAINT_TOOLTIPS)) {
      expect(words.heading.length).toBeGreaterThan(0);
      expect(words.text.endsWith('.')).toBe(true);
    }
  });

  it('R49 every control is described by its tooltip and carries no native title (the reset arrows and remove marks keep theirs)', () => {
    const full = { ...DEFAULT_BRUSH, height: { ...DEFAULT_BRUSH.height, on: true }, edgeBurn: { ...DEFAULT_BRUSH.edgeBurn, on: true, direction: 'raise' as const } };
    const palette = setMaterial(setShape(EMPTY_PALETTE, 0, 3), steel);
    const { container } = renderPanel(full, palette);
    const controls = [...container.querySelectorAll<HTMLElement>('button, input')].filter((element) => {
      const name = element.getAttribute('aria-label') ?? '';
      return !name.startsWith('Reset') && !name.startsWith('Remove');
    });
    expect(controls.length).toBeGreaterThanOrEqual(14);
    for (const control of controls) {
      const label = control.getAttribute('aria-label') ?? control.textContent;
      expect(control.hasAttribute('title'), `${label} has a title`).toBe(false);
      const described = control.closest('[aria-describedby]')?.getAttribute('aria-describedby');
      expect(described, `${label} has no tooltip`).toBeTruthy();
      expect(document.getElementById(described!.split(' ').pop()!)?.className).toContain('ui-tooltip__description');
    }
  });

  it('R49 on a slider the track, the number and the dice opt out of the row tooltip; the label does not', () => {
    const { container } = renderPanel({ ...DEFAULT_BRUSH, strength: { ...DEFAULT_BRUSH.strength, random: true } });
    const row = container.querySelector('.ui-slider')!;
    const skipped = (element: Element): boolean => element.closest('[data-tooltip-skip]') !== null;
    expect(skipped(row.querySelector('.ui-slider__label')!)).toBe(false);
    expect(skipped(row.querySelector('[role="slider"], input[type="range"]')!)).toBe(true);
    expect(skipped(row.querySelector('.ui-slider__readout')!)).toBe(true);
  });

  it('R9 the Size slider reaches 1 (the whole picture)', () => {
    renderPanel();
    expect((screen.getByRole('slider', { name: 'Size' }) as HTMLInputElement).max).toBe('1');
  });

  it('R74 the brush rows run Size, Rotation, Strength, Hardness, Distance', () => {
    renderPanel();
    const order = screen.getAllByRole('slider').map((slider) => slider.getAttribute('aria-label') ?? '');
    const picked = order.filter((name) => ['Size', 'Rotation', 'Strength', 'Hardness', 'Distance'].includes(name));
    expect(picked).toEqual(['Size', 'Rotation', 'Strength', 'Hardness', 'Distance']);
  });

  it('R12 R50 the Random rotation switch is gone: the Rotation dice replaces it', () => {
    renderPanel();
    expect(screen.queryByRole('switch', { name: 'Random rotation' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Random Rotation' })).toBeTruthy();
  });

  it.each(['Size', 'Strength', 'Hardness', 'Distance', 'Rotation'])('R50 %s has a dice on its row that is active or inactive and swaps the slider for the range', (label) => {
    const key = label.toLowerCase() as BrushControlKey;
    const { onBrushChange } = renderPanel();
    const dice = screen.getByRole('button', { name: `Random ${label}` });
    expect(dice.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('slider', { name: label })).toBeTruthy();
    expect(screen.queryByRole('slider', { name: `${label}, low` })).toBeNull();
    fireEvent.click(dice);
    expect(onBrushChange).toHaveBeenLastCalledWith({ ...DEFAULT_BRUSH, [key]: { ...DEFAULT_BRUSH[key], random: true } });
  });

  it('R44 R50 with the dice on, the range sliders replace the single slider, both ends of the control, and the dice shows as pressed', () => {
    const on = { ...DEFAULT_BRUSH, size: { ...DEFAULT_BRUSH.size, random: true } };
    renderPanel(on);
    expect(screen.queryByRole('slider', { name: 'Size' })).toBeNull();
    expect(screen.getByRole('slider', { name: 'Size, low' }).getAttribute('aria-valuenow')).toBe('0.02');
    expect(screen.getByRole('slider', { name: 'Size, high' }).getAttribute('aria-valuenow')).toBe('1');
    expect(screen.getByRole('button', { name: 'Random Size' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('slider', { name: 'Strength' })).toBeTruthy(); // the other controls are untouched
  });

  it('R50 R51 the reset arrow of a range puts both ends back and leaves the single value', () => {
    const moved = { ...DEFAULT_BRUSH, strength: { value: 0.4, random: true, low: 0.2, high: 0.6 } };
    const { onBrushChange } = renderPanel(moved);
    fireEvent.click(screen.getByRole('button', { name: 'Reset Strength' }));
    expect(onBrushChange).toHaveBeenLastCalledWith({ ...moved, strength: { value: 0.4, random: true, low: 0, high: 1 } });
  });

  it('R50 a single slider still edits only its value', () => {
    const { onBrushChange } = renderPanel();
    fireEvent.change(screen.getByRole('slider', { name: 'Hardness' }), { target: { value: '0.3' } });
    expect(onBrushChange).toHaveBeenLastCalledWith({ ...DEFAULT_BRUSH, hardness: { ...DEFAULT_BRUSH.hardness, value: 0.3 } });
  });

  it('R5 with shapes chosen the shape swatches show thumbnails, in slot order after the material', () => {
    renderPanel(DEFAULT_BRUSH, setShape(EMPTY_PALETTE, 1, 7));
    expect(screen.getByRole('button', { name: 'Use shape 2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add shape 1' })).toBeTruthy();
  });

  it('R57 a filled shape swatch is a toggle: pressed when active, a click asks to flip it and never opens the picker', () => {
    const palette = toggleActive(setShape(setShape(EMPTY_PALETTE, 0, 7), 1, 9), 1);
    const { onToggleShapeActive, onPickShape } = renderPanel(DEFAULT_BRUSH, palette);
    expect(screen.getByRole('button', { name: 'Use shape 1' }).getAttribute('aria-pressed')).toBe('true');
    const second = screen.getByRole('button', { name: 'Use shape 2' });
    expect(second.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(second);
    expect(onToggleShapeActive).toHaveBeenCalledWith(1);
    expect(onPickShape).not.toHaveBeenCalled();
  });

  it('R57 an empty slot still opens its picker, and the remove mark still removes', () => {
    const { onPickShape, onRemoveShape } = renderPanel(DEFAULT_BRUSH, setShape(EMPTY_PALETTE, 1, 7));
    fireEvent.click(screen.getByRole('button', { name: 'Add shape 1' }));
    expect(onPickShape).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole('button', { name: 'Remove shape 2' }));
    expect(onRemoveShape).toHaveBeenCalledWith(1);
  });

  it('R58 the picker grid area has a fixed height, and both pickers\' tiles fade in once, not under reduced motion', () => {
    const css = readFileSync(resolve(__dirname, '../../../../src/materialgen/compositing/ui/paintPanel.css'), 'utf8');
    expect(css).toMatch(/\.picker-overlay__grid-scroll\s*\{[^}]*\bheight:\s*70vh;/);
    expect(css).not.toMatch(/\.picker-overlay__grid-scroll\s*\{[^}]*max-height/);
    expect(css).toMatch(/\.shape-picker__tile,\s*\.material-picker__tile\s*\{[^}]*animation:\s*picker-tile-in 160ms/);
    expect(css).toMatch(/@keyframes picker-tile-in\s*\{\s*from\s*\{\s*opacity:\s*0;/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.shape-picker__tile,\s*\.material-picker__tile\s*\{\s*animation:\s*none;/);
  });

  it('R57 the active swatch uses the mask swatches\' outline (2 px accent, 2 px offset)', () => {
    const css = readFileSync(resolve(__dirname, '../../../../src/materialgen/compositing/ui/paintPanel.css'), 'utf8');
    expect(css).toMatch(/\.palette-swatches \.reference-strip__thumb\[aria-pressed='true'\]\s*\{[^}]*outline:\s*2px solid var\(--accent\);[^}]*outline-offset:\s*2px/);
  });
});
