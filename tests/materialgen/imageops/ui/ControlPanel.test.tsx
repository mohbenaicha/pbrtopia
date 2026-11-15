// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATEGORY_LABELS, controlsFor, createDefaultEditValues, type EditValues } from '@mat/imageops';
import { ControlPanel } from '@mat/imageops/ui/ControlPanel';

afterEach(cleanup);

const controls = controlsFor('albedo');

function renderPanel(values: EditValues = createDefaultEditValues('albedo')) {
  const onChange = vi.fn();
  render(<ControlPanel controls={controls} categoryLabels={CATEGORY_LABELS} values={values} onChange={onChange} />);
  return { onChange };
}

describe('imageops/ui ControlPanel', () => {
  it('R17 controls sit in an accordion of the categories the map kind has, the first open and one open at a time', () => {
    renderPanel();
    const headings = screen.getAllByRole('button', { expanded: true }).concat(screen.getAllByRole('button', { expanded: false }));
    expect(headings.map((button) => button.querySelector('.ui-disclosure__title')?.textContent)).toEqual(expect.arrayContaining(['Tone', 'Colour', 'Detail', 'Surface']));
    expect(screen.getByRole('button', { name: 'Tone' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('slider', { name: 'Exposure' })).toBeTruthy();
    expect(screen.queryByRole('slider', { name: 'Saturation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Colour' }));
    expect(screen.getByRole('button', { name: 'Tone' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('slider', { name: 'Saturation' })).toBeTruthy();
    expect(screen.queryByRole('slider', { name: 'Exposure' })).toBeNull();
  });

  it('R17 a control row has a slider, a number input and a reset-to-default arrow', () => {
    renderPanel();
    expect(screen.getByRole('slider', { name: 'Exposure' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Exposure value' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset Exposure' })).toBeTruthy();
  });

  it('R17 moving the slider reports the new value', () => {
    const { onChange } = renderPanel();
    fireEvent.change(screen.getByRole('slider', { name: 'Exposure' }), { target: { value: '1.5' } });
    expect(onChange).toHaveBeenCalledWith('exposure', 1.5);
  });

  it('R86 while the pointer is held a slider reports nothing, and the last value is reported once on release, anywhere on the page', () => {
    const { onChange } = renderPanel();
    const slider = screen.getByRole('slider', { name: 'Exposure' });
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '1' } });
    fireEvent.change(slider, { target: { value: '1.5' } });
    expect(onChange).not.toHaveBeenCalled();
    expect((screen.getByRole('slider', { name: 'Exposure' }) as HTMLInputElement).value).toBe('1.5'); // the slider still follows the pointer
    fireEvent.pointerUp(window);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('exposure', 1.5);
  });

  it('R86 a click on the rail (press, one change, release) reports once, on the release', () => {
    const { onChange } = renderPanel();
    const slider = screen.getByRole('slider', { name: 'Exposure' });
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '2' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(window);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('exposure', 2);
  });

  it('R86 a cancelled pointer also reports, and a release with no change reports nothing', () => {
    const { onChange } = renderPanel();
    const slider = screen.getByRole('slider', { name: 'Exposure' });
    fireEvent.pointerDown(slider);
    fireEvent.pointerUp(window);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '0.5' } });
    fireEvent.pointerCancel(window);
    expect(onChange).toHaveBeenCalledWith('exposure', 0.5);
  });

  it('R86 a reset arrow clicked after a press and release is reported at once', () => {
    const { onChange } = renderPanel({ ...createDefaultEditValues('albedo'), exposure: 2 });
    const reset = screen.getByRole('button', { name: 'Reset Exposure' });
    fireEvent.pointerDown(reset);
    fireEvent.pointerUp(window);
    fireEvent.click(reset);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('exposure', 0);
  });

  it('R16 a number typed outside the range is clamped to it when it is committed', () => {
    const { onChange } = renderPanel();
    const input = screen.getByRole('spinbutton', { name: 'Exposure value' });
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith('exposure', 3);
  });

  it('R16 text that is not a number becomes the default when it is committed', () => {
    const { onChange } = renderPanel({ ...createDefaultEditValues('albedo'), exposure: 2 });
    const input = screen.getByRole('spinbutton', { name: 'Exposure value' });
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith('exposure', 0);
  });

  it('R17 the reset arrow is disabled at the default and returns that one control to its default otherwise', () => {
    const { onChange } = renderPanel({ ...createDefaultEditValues('albedo'), exposure: 2 });
    expect((screen.getByRole('button', { name: 'Reset Exposure' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Reset Brightness' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reset Exposure' }));
    expect(onChange).toHaveBeenCalledWith('exposure', 0);
  });

  it('R17 a toggle control is a switch with no number input', () => {
    const roughControls = controlsFor('rough');
    const onChange = vi.fn();
    render(<ControlPanel controls={roughControls} categoryLabels={CATEGORY_LABELS} values={createDefaultEditValues('rough')} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Surface' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Invert' }));
    expect(onChange).toHaveBeenCalledWith('invert', 1);
    expect(screen.queryByRole('spinbutton', { name: 'Invert value' })).toBeNull();
  });

  it('R17 a category the map kind does not have is not listed', () => {
    render(<ControlPanel controls={controlsFor('normal')} categoryLabels={CATEGORY_LABELS} values={createDefaultEditValues('normal')} onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Colour' })).toBeNull(); // a normal map has no colour controls
    expect(screen.getByRole('button', { name: 'Detail' })).toBeTruthy();
  });
});
