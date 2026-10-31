// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageViewer } from '../../src/ui-kit';

afterEach(cleanup);

const FRAME = { width: 400, height: 300 };

// jsdom has no layout: the frame is given a size and the picture a natural size, the two things the viewer reads when the wheel turns.
function sizeThePicture(): { frame: HTMLElement; picture: HTMLImageElement } {
  const frame = screen.getByTestId('image-viewer-frame');
  frame.getBoundingClientRect = () => ({ ...FRAME, left: 0, top: 0, right: FRAME.width, bottom: FRAME.height, x: 0, y: 0, toJSON: () => ({}) });
  const picture = screen.getByRole('img', { name: 'Body albedo' }) as HTMLImageElement;
  Object.defineProperty(picture, 'naturalWidth', { value: 400 });
  Object.defineProperty(picture, 'naturalHeight', { value: 300 });
  return { frame, picture };
}

const open = (props: Partial<React.ComponentProps<typeof ImageViewer>> = {}) =>
  render(<ImageViewer title="Body albedo" src="blob:body" onClose={() => undefined} {...props} />);

describe('ImageViewer', () => {
  it('viewport-layout R33 is a modal named by the picture, with the picture and the detail lines', () => {
    open({ details: ['Size: 400 x 300', 'Colour space: sRGB'] });
    expect(screen.getByRole('dialog', { name: 'Body albedo' }).getAttribute('aria-modal')).toBe('true');
    expect((screen.getByRole('img', { name: 'Body albedo' }) as HTMLImageElement).src).toBe('blob:body');
    expect(screen.getByText('Size: 400 x 300')).toBeTruthy();
    expect(screen.getByText('Colour space: sRGB')).toBeTruthy();
  });

  it('viewport-layout R33 shows Download and Close in the top-right of the viewer, before the picture', () => {
    const onDownload = vi.fn();
    const onClose = vi.fn();
    open({ onDownload, downloadLabel: 'Download Body albedo', onClose });
    const download = screen.getByRole('button', { name: 'Download Body albedo' });
    const header = download.closest('.ui-dialog__header');
    expect(header).not.toBeNull();
    expect(header!.contains(screen.getByRole('button', { name: 'Close' }))).toBe(true);
    expect(header!.textContent).toContain('Body albedo'); // the title is at the left of the same bar
    fireEvent.click(download);
    expect(onDownload).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('viewport-layout R33 has no Download button when the caller gives none to run', () => {
    open();
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
  });

  it('viewport-layout R33 Escape closes it', async () => {
    const onClose = vi.fn();
    open({ onClose });
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('viewport-layout R33 a picture that could not be read says so instead of showing nothing', () => {
    open({ src: null, failed: true });
    expect(screen.getByText('Preview unavailable')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('viewport-layout R33 the wheel zooms the picture toward the pointer and never scrolls the page behind', () => {
    open();
    const { frame, picture } = sizeThePicture();
    expect(picture.style.transform).toBe('translate(0px, 0px) scale(1)');
    const notPrevented = fireEvent.wheel(frame, { deltaY: -100, clientX: 300, clientY: 150 });
    expect(notPrevented).toBe(false); // preventDefault was called
    const match = /^translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)$/.exec(picture.style.transform);
    expect(match).not.toBeNull();
    const [x, , zoom] = [Number(match![1]), Number(match![2]), Number(match![3])];
    expect(zoom).toBeGreaterThan(1);
    expect(x).toBeLessThan(0); // the pointer is right of the centre, so the picture moves left to keep that point under it
  });

  it('viewport-layout R33 a double-click returns to the fitted size', () => {
    open();
    const { frame, picture } = sizeThePicture();
    fireEvent.wheel(frame, { deltaY: -300, clientX: 300, clientY: 100 });
    expect(picture.style.transform).not.toBe('translate(0px, 0px) scale(1)');
    fireEvent.doubleClick(frame);
    expect(picture.style.transform).toBe('translate(0px, 0px) scale(1)');
  });

  it('viewport-layout R33 dragging pans a zoomed picture and cannot pan a fitted one', () => {
    open();
    const { frame, picture } = sizeThePicture();
    fireEvent.mouseDown(frame, { clientX: 200, clientY: 150, button: 0 });
    fireEvent.mouseMove(document, { clientX: 260, clientY: 150 });
    fireEvent.mouseUp(document, { clientX: 260, clientY: 150 });
    expect(picture.style.transform).toBe('translate(0px, 0px) scale(1)');
    fireEvent.wheel(frame, { deltaY: -300, clientX: 200, clientY: 150 }); // zoom about the centre
    fireEvent.mouseDown(frame, { clientX: 200, clientY: 150, button: 0 });
    fireEvent.mouseMove(document, { clientX: 230, clientY: 150 });
    fireEvent.mouseUp(document, { clientX: 230, clientY: 150 });
    expect(picture.style.transform).toMatch(/^translate\(30px, 0px\) scale\(/);
  });
});
