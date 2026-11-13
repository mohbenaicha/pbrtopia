// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompareStage } from '../../src/ui-kit';

afterEach(cleanup);

const AREA = { width: 400, height: 400 };
const SOURCES = [
  { id: 'a', label: 'Albedo', src: 'blob:a' },
  { id: 'b', label: 'Roughness', src: 'blob:b' },
  { id: 'c', label: 'Normal', src: 'blob:c' },
];

describe('CompareStage overlay (imageops R80)', () => {
  it('R80 an overlay picture is drawn once over the whole stage, with the pictures\' zoom and pan, and none when there is none', () => {
    const putImageData = vi.fn();
    vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} }); // jsdom has none
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ putImageData } as never);
    const { rerender } = render(<CompareStage sources={SOURCES} />);
    expect(screen.queryByTestId('compare-overlay')).toBeNull();
    const rgba = new Uint8ClampedArray(2 * 2 * 4).fill(7);
    rerender(<CompareStage sources={SOURCES} overlay={{ width: 2, height: 2, rgba }} />);
    const canvas = screen.getByTestId('compare-overlay') as HTMLCanvasElement;
    expect(canvas.width).toBe(2);
    expect(canvas.style.pointerEvents).toBe('none');
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(canvas.style.transform).toBe(screen.getAllByRole('img')[0]!.style.transform);
    expect(putImageData).toHaveBeenCalledTimes(1);
    expect((putImageData.mock.calls[0]![0] as ImageData).data[0]).toBe(7);
    rerender(<CompareStage sources={SOURCES} overlay={null} />);
    expect(screen.queryByTestId('compare-overlay')).toBeNull();
    getContext.mockRestore();
    vi.unstubAllGlobals();
  });
});

const open = (props: Partial<React.ComponentProps<typeof CompareStage>> = {}) =>
  render(<CompareStage sources={SOURCES} {...props} />);

// jsdom has no layout: the picture area is given a size so pointer positions can be turned into percentages.
function sizeTheArea(): HTMLElement {
  const area = screen.getByTestId('compare-viewer-area');
  area.getBoundingClientRect = () => ({ ...AREA, left: 0, top: 0, right: AREA.width, bottom: AREA.height, x: 0, y: 0, toJSON: () => ({}) });
  return area;
}

const divider = (): HTMLElement => screen.getByRole('slider', { name: 'Comparison divider' });
const pictures = (): HTMLImageElement[] => screen.getAllByRole('img') as HTMLImageElement[];
const viewOf = (): string[] => pictures().map((picture) => picture.style.transform);

describe('CompareStage (materialgen-prep S5)', () => {
  it('R40 draws the detail lines under the pictures and has no dialog of its own', () => {
    open({ details: ['Size: 512 x 512'] });
    expect(screen.getByText('Size: 512 x 512')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('R41 shows the first source on the left and the second on the right over one area', () => {
    open();
    expect(screen.queryByRole('combobox')).toBeNull(); // no choosers: the first source is always the left, the second the right
    const [left, right] = pictures();
    expect(left?.alt).toBe('Albedo');
    expect(right?.alt).toBe('Roughness');
    expect(left?.src).toBe('blob:a');
    expect(right?.src).toBe('blob:b');
    expect(screen.getByTestId('compare-viewer-area').contains(left!)).toBe(true);
    expect(screen.getByTestId('compare-viewer-area').contains(right!)).toBe(true);
  });

  it('R42 only the first two sources are drawn, with no select to change them', () => {
    open();
    expect(pictures().map((picture) => picture.src)).toEqual(['blob:a', 'blob:b']); // the third source (Normal) is not offered
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('R43 the divider is a slider named "Comparison divider" that starts at the middle', () => {
    open();
    expect(divider().getAttribute('aria-valuemin')).toBe('0');
    expect(divider().getAttribute('aria-valuemax')).toBe('100');
    expect(divider().getAttribute('aria-valuenow')).toBe('50');
  });

  it('R43 the keyboard moves the divider by 1, by 10 with Shift, and to the ends with Home and End', async () => {
    const user = userEvent.setup();
    open();
    divider().focus();
    await user.keyboard('{ArrowRight}');
    expect(divider().getAttribute('aria-valuenow')).toBe('51');
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(divider().getAttribute('aria-valuenow')).toBe('41');
    await user.keyboard('{End}');
    expect(divider().getAttribute('aria-valuenow')).toBe('100');
    await user.keyboard('{Home}');
    expect(divider().getAttribute('aria-valuenow')).toBe('0');
    await user.keyboard('{ArrowLeft}');
    expect(divider().getAttribute('aria-valuenow')).toBe('0');
  });

  it('R43 dragging moves the divider to the pointer, clamped to the picture area', () => {
    open();
    sizeTheArea();
    fireEvent.pointerDown(divider(), { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 100, pointerId: 1 });
    expect(divider().getAttribute('aria-valuenow')).toBe('25');
    fireEvent.pointerMove(divider(), { clientX: 999, pointerId: 1 });
    expect(divider().getAttribute('aria-valuenow')).toBe('100');
    fireEvent.pointerMove(divider(), { clientX: -50, pointerId: 1 });
    expect(divider().getAttribute('aria-valuenow')).toBe('0');
    fireEvent.pointerUp(divider(), { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 300, pointerId: 1 });
    expect(divider().getAttribute('aria-valuenow')).toBe('0'); // a released divider no longer follows the pointer
  });

  it('R43 the right picture is clipped from the divider to the right edge', () => {
    open();
    const right = pictures()[1]!;
    expect(right.parentElement?.style.clipPath).toBe('inset(0 0 0 50%)');
    divider().focus();
    fireEvent.keyDown(divider(), { key: 'End' });
    expect(right.parentElement?.style.clipPath).toBe('inset(0 0 0 100%)');
  });

  it('R44 a wheel zooms both sides together, and a double-click fits them again', () => {
    open();
    const area = sizeTheArea();
    for (const picture of pictures()) {
      Object.defineProperty(picture, 'naturalWidth', { value: 400, configurable: true });
      Object.defineProperty(picture, 'naturalHeight', { value: 400, configurable: true });
    }
    const fitted = 'translate(0px, 0px) scale(1)';
    expect(viewOf()).toEqual([fitted, fitted]);
    fireEvent.wheel(area, { deltaY: -400, clientX: 200, clientY: 200 });
    const [left, right] = viewOf();
    expect(left).toMatch(/scale\((?!1\))/);
    expect(right).toBe(left); // the same area of the picture is visible on both sides
    fireEvent.doubleClick(area);
    expect(viewOf()).toEqual([fitted, fitted]);
  });

  it('R44 dragging the divider does not pan the picture', () => {
    open();
    const area = sizeTheArea();
    for (const picture of pictures()) {
      Object.defineProperty(picture, 'naturalWidth', { value: 400, configurable: true });
      Object.defineProperty(picture, 'naturalHeight', { value: 400, configurable: true });
    }
    fireEvent.wheel(area, { deltaY: -800, clientX: 200, clientY: 200 });
    const zoomed = viewOf();
    fireEvent.mouseDown(divider(), { button: 0, clientX: 200, clientY: 200 });
    fireEvent.mouseMove(document, { clientX: 260, clientY: 240 });
    fireEvent.mouseUp(document);
    expect(viewOf()).toEqual(zoomed);
  });

  it('R44 a drag on the picture pans it once it is zoomed', () => {
    open();
    const area = sizeTheArea();
    for (const picture of pictures()) {
      Object.defineProperty(picture, 'naturalWidth', { value: 400, configurable: true });
      Object.defineProperty(picture, 'naturalHeight', { value: 400, configurable: true });
    }
    fireEvent.wheel(area, { deltaY: -800, clientX: 200, clientY: 200 });
    const zoomed = viewOf();
    fireEvent.mouseDown(area, { button: 0, clientX: 200, clientY: 200 });
    fireEvent.mouseMove(document, { clientX: 230, clientY: 210 });
    fireEvent.mouseUp(document);
    const panned = viewOf();
    expect(panned[0]).not.toBe(zoomed[0]);
    expect(panned[1]).toBe(panned[0]);
  });

  it('R45 a side still being read shows a loading status while the other side keeps its picture', () => {
    open({ sources: [{ id: 'a', label: 'Albedo', src: 'blob:a' }, { id: 'b', label: 'Roughness', src: null }] });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(pictures()).toHaveLength(1);
    expect(pictures()[0]?.src).toBe('blob:a');
    expect(divider()).toBeTruthy();
  });

  it('R45 a source that could not be read shows a failure line instead of a picture', () => {
    open({ sources: [{ id: 'a', label: 'Albedo', src: 'blob:a' }, { id: 'b', label: 'Roughness', src: null, failed: true }] });
    expect(screen.getByText('Preview unavailable')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(pictures()).toHaveLength(1);
  });

  it('R46 both sides fill one rectangle that has the aspect of the left picture', () => {
    open();
    const left = pictures()[0]!;
    Object.defineProperty(left, 'naturalWidth', { value: 600, configurable: true });
    Object.defineProperty(left, 'naturalHeight', { value: 300, configurable: true });
    fireEvent.load(left);
    expect(screen.getByTestId('compare-viewer-area').style.aspectRatio).toBe('600 / 300');
    for (const picture of pictures()) expect(picture.className).toContain('ui-compare-viewer__picture'); // each fills the same rectangle (object-fit: fill)
  });

  it('R47 one source fills the area with no divider and no right select', () => {
    open({ sources: [{ id: 'a', label: 'Albedo', src: 'blob:a' }] });
    expect(pictures()).toHaveLength(1);
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(pictures()[0]?.parentElement?.style.clipPath ?? '').toBe('');
  });

  it('R48 moving the divider does not change the picture elements or leave the control', async () => {
    const user = userEvent.setup();
    open();
    const before = pictures();
    divider().focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(document.activeElement).toBe(divider());
    expect(pictures()).toEqual(before); // the same elements, so nothing reloaded
  });
});
