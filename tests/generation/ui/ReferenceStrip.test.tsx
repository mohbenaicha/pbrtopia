// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReferenceImage } from '../../../src/generation/generateStore';
import { ReferenceStrip } from '../../../src/generation/ui/ReferenceStrip';

const image = (id: string): ReferenceImage => ({ id, name: `${id}.png`, width: 64, height: 64, blob: new Blob(['x'], { type: 'image/png' }) });

beforeEach(() => {
  URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => `blob:fake/${(blob as Blob).size}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

function setup(references: ReferenceImage[] = [image('a'), image('b')], notice: string | null = null) {
  const props = { onFiles: vi.fn<(files: File[]) => void>(), onRemove: vi.fn<(id: string) => void>() };
  render(<ReferenceStrip references={references} notice={notice} {...props} />);
  return props;
}

describe('ReferenceStrip (R2)', () => {
  it('R2 shows one thumbnail per reference with its name', () => {
    setup();
    expect(screen.getByRole('img', { name: 'a.png' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'b.png' })).toBeTruthy();
  });

  it('R2 passes the chosen files up and clears the input so the same file can be chosen again', () => {
    const { onFiles } = setup([]);
    const input = screen.getByLabelText('Add reference images') as HTMLInputElement;
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
    expect(input.value).toBe('');
  });

  it('R2 removing a reference names it', () => {
    const { onRemove } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Remove b.png' }));
    expect(onRemove).toHaveBeenCalledWith('b');
  });

  it('R2 a click on a thumbnail opens the enlarged image and Close removes it', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge a.png' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('img')?.getAttribute('alt')).toBe('a.png');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('R2 the enlarged image is the large viewer with Download in its top-right, saving the image under its own name with its size shown', () => {
    const saved: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge b.png' }));
    expect(screen.getByRole('dialog', { name: 'b.png' }).querySelector('.ui-dialog__header')).not.toBeNull();
    expect(screen.getByText('Size: 64 x 64')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Download b.png' }));
    expect(saved).toEqual(['b.png']);
    vi.restoreAllMocks();
  });

  it('R2 shows why a reference was refused', () => {
    setup([image('a')], 'This model takes at most 14 images in total and one is the atlas, so up to 13 references.');
    expect(screen.getByRole('status').textContent).toMatch(/up to 13 references/);
  });

  it('R2 the remove button is a compact badge, not a full-size control over the preview', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Remove a.png' }).hasAttribute('data-compact')).toBe(true);
  });

  it('R2 releases the object URLs when a thumbnail goes away', () => {
    const { unmount } = render(<ReferenceStrip references={[image('a')]} notice={null} onFiles={vi.fn()} onRemove={vi.fn()} />);
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
