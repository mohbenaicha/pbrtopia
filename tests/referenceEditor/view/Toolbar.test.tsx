// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorSettings } from '../../../src/referenceEditor/stroke/settings';
import type { StageHandle } from '../../../src/referenceEditor/view/CanvasStage';
import { HISTORY_DROPPED, NEED_SELECTION, Toolbar, type ToolbarState } from '../../../src/referenceEditor/view/Toolbar';
import { describeTooltipOf, openTooltipTextOf } from '../../support/tooltipDescription';

afterEach(cleanup);

const SETTINGS: EditorSettings = { tool: 'paint', colour: 0xff000000, brushSize: 24 };
const STATE: ToolbarState = { hasSelection: false, canUndo: false, canRedo: false, droppedOlder: false };

function setup(state: Partial<ToolbarState> = {}, accepts = true, settings: EditorSettings = SETTINGS) {
  const handle: StageHandle = { accepts: vi.fn(() => accepts), run: vi.fn(), fit: vi.fn(), zoom: vi.fn(), flushAndEncode: vi.fn() };
  const onSettings = vi.fn();
  const onChanged = vi.fn();
  render(<Toolbar settings={settings} state={{ ...STATE, ...state }} stage={{ current: handle }} onSettings={onSettings} onChanged={onChanged} />);
  return { handle, onSettings, onChanged };
}

describe('Toolbar (reference-editor R6, R14, R20)', () => {
  it('R20 the tool buttons report which one is active with aria-pressed', () => {
    setup({}, true, { ...SETTINGS, tool: 'selectRect' });
    expect(screen.getByRole('button', { name: 'Select rectangle' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Paint' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Select with brush' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('R20 Invert, Fill and Crop are disabled with no selection and say why', () => {
    setup();
    for (const name of ['Invert', 'Fill', 'Crop']) {
      const button = screen.getByRole('button', { name });
      expect((button as HTMLButtonElement).disabled).toBe(true);
      expect(describeTooltipOf(button)).toContain(NEED_SELECTION);
    }
  });

  it('R20 with a selection they are enabled and run on the stage', () => {
    const { handle, onChanged } = setup({ hasSelection: true });
    fireEvent.click(screen.getByRole('button', { name: 'Invert' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }));
    expect(vi.mocked(handle.run).mock.calls.map((call) => call[0])).toEqual(['invert', 'fill', 'crop']);
    expect(onChanged).toHaveBeenCalledTimes(3);
  });

  it('R20 every control has a text label', () => {
    setup({ hasSelection: true, canUndo: true, canRedo: true });
    for (const name of ['Paint', 'Select with brush', 'Select rectangle', 'Invert', 'Fill', 'Crop', 'Undo', 'Redo', 'Zoom in', 'Zoom out', 'Fit']) expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.getByLabelText('Colour')).toBeTruthy();
    expect(screen.getByRole('slider', { name: /Brush size/ })).toBeTruthy();
  });

  it('R6 the colour starts black and the brush size runs from 1 to 256, default 24', () => {
    setup();
    expect((screen.getByLabelText('Colour') as HTMLInputElement).value).toBe('#000000');
    const slider = screen.getByRole('slider', { name: /Brush size/ }) as HTMLInputElement;
    expect([slider.min, slider.max, slider.value]).toEqual(['1', '256', '24']);
  });

  it('R6 choosing a tool or a colour asks the stage first and applies it when accepted', () => {
    const { onSettings, handle } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Select rectangle' }));
    expect(handle.accepts).toHaveBeenCalledWith('setTool');
    expect(onSettings).toHaveBeenCalledWith({ ...SETTINGS, tool: 'selectRect' });
    fireEvent.change(screen.getByLabelText('Colour'), { target: { value: '#ff8000' } });
    expect(onSettings).toHaveBeenLastCalledWith({ ...SETTINGS, colour: 0xff0080ff });
  });

  it('R6 while a drag is in progress (the stage refuses) no setting changes', () => {
    const { onSettings } = setup({}, false);
    fireEvent.click(screen.getByRole('button', { name: 'Select rectangle' }));
    fireEvent.change(screen.getByRole('slider', { name: /Brush size/ }), { target: { value: '100' } });
    expect(onSettings).not.toHaveBeenCalled();
  });

  it('R6 the brush size slider is clamped to the allowed range', () => {
    const { onSettings } = setup();
    fireEvent.change(screen.getByRole('slider', { name: /Brush size/ }), { target: { value: '100' } });
    expect(onSettings).toHaveBeenCalledWith({ ...SETTINGS, brushSize: 100 });
  });

  it('R14 Undo and Redo follow the history and Undo says when older steps were dropped', () => {
    setup({ canUndo: true, canRedo: false, droppedOlder: true });
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Redo' }) as HTMLButtonElement).disabled).toBe(true);
    expect(openTooltipTextOf(screen.getByRole('button', { name: 'Undo' }))).toContain(HISTORY_DROPPED);
  });

  it('R5 Zoom in and Zoom out step by two, Fit refits', () => {
    const { handle } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(vi.mocked(handle.zoom).mock.calls).toEqual([[2], [0.5]]);
    expect(handle.fit).toHaveBeenCalledTimes(1);
  });
});
