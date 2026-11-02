// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { card, planOf, setupOverlay, SUNBURST } from './setupHarness';

beforeEach(() => {
  let count = 0;
  URL.createObjectURL = vi.fn(() => `blob:fake/${++count}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const TALL = { x: 0.25, y: 0.1, w: 0.5, h: 0.8 };
const THIN = { x: 0.375, y: 0, w: 0.25, h: 1 };
const FULL = { x: 0, y: 0, w: 1, h: 1 };

describe('trimmed snapshots and the sheet preview (custom R3, R5)', () => {
  it('custom R3 a snapshot thumbnail has the aspect of its trim, not a square', () => {
    setupOverlay({ trims: [TALL, THIN, FULL, FULL, FULL, FULL] });
    const items = within(screen.getByRole('group', { name: 'Snapshots' })).getAllByRole('figure');
    const aspectOf = (item: HTMLElement): string => (item.querySelector('.setup-thumb') as HTMLElement).style.getPropertyValue('--trim-aspect');
    expect(Number(aspectOf(items[0]!))).toBeCloseTo(0.5 / 0.8);
    expect(Number(aspectOf(items[1]!))).toBeCloseTo(0.25);
    expect(Number(aspectOf(items[2]!))).toBeCloseTo(1);
  });

  it('custom R3 the picture inside a thumbnail is the snapshot cropped to the trim', () => {
    setupOverlay({ trims: [{ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, FULL, FULL, FULL, FULL, FULL] });
    const image = within(screen.getByRole('group', { name: 'Snapshots' })).getAllByRole('figure')[0]!.querySelector('img')!;
    expect(image.style.width).toBe('200%');
    expect(image.style.height).toBe('400%');
    expect(image.style.left).toBe('-50%');
    expect(image.style.top).toBe('-200%');
  });

  it('custom R3 the thumbnails on a card are trimmed the same way', () => {
    setupOverlay({ activePlan: planOf([[0]]), trims: [TALL, FULL, FULL, FULL, FULL, FULL] });
    const thumb = within(card('Image 1')).getByRole('list').querySelector('.setup-thumb') as HTMLElement;
    expect(Number(thumb.style.getPropertyValue('--trim-aspect'))).toBeCloseTo(0.5 / 0.8);
  });

  it('custom R5 the drop area shows one tile per assigned perspective at the position the layout gives, cropped to its trim', () => {
    setupOverlay({
      activePlan: planOf([[1, 0]]),
      trims: [TALL, THIN, FULL, FULL, FULL, FULL],
      previewsOf: () => [
        {
          aspect: 1.5,
          tiles: [
            { camera: 1, x: 0.1, y: 0.2, w: 0.3, h: 0.6 },
            { camera: 0, x: 0.5, y: 0.1, w: 0.4, h: 0.8 },
          ],
        },
      ],
    });
    const preview = within(card('Image 1')).getByTestId('sheet-preview');
    expect(preview.style.getPropertyValue('--drop-aspect')).toBe('1.5');
    const tiles = preview.querySelectorAll<HTMLElement>('[data-camera]');
    expect(Array.from(tiles).map((tile) => tile.getAttribute('data-camera'))).toEqual(['1', '0']);
    expect([tiles[0]!.style.left, tiles[0]!.style.top, tiles[0]!.style.width, tiles[0]!.style.height]).toEqual(['10%', '20%', '30%', '60%']);
    expect([tiles[1]!.style.left, tiles[1]!.style.top, tiles[1]!.style.width, tiles[1]!.style.height]).toEqual(['50%', '10%', '40%', '80%']);
    expect(tiles[1]!.querySelector('img')!.style.width).toBe('200%'); // the tall person's trim is 0.5 wide
  });

  it('custom R5 a sheet with cameras but no canvas (the model offers no size) shows no preview, and the drop hint stays', () => {
    setupOverlay({ activePlan: planOf([[0]]), previewsOf: () => [null] });
    expect(within(card('Image 1')).queryByTestId('sheet-preview')).toBeNull();
    expect(within(card('Image 1')).getByTestId('canvas-box').textContent).toContain('Drop a perspective here');
  });

  it('custom R5 the preview follows an edit: removing a perspective redraws the canvas', () => {
    const previewsOf = vi.fn((plan: ReturnType<typeof planOf>) => plan.sheets.map((sheet) => ({ aspect: 1, tiles: sheet.cameras.map((camera) => ({ camera, x: 0, y: 0, w: 0.5, h: 0.5 })) })));
    setupOverlay({ activePlan: planOf([[0, 1]]), previewsOf });
    expect(within(card('Image 1')).getByTestId('sheet-preview').querySelectorAll('[data-camera]')).toHaveLength(2);
    fireEvent.click(within(card('Image 1')).getByRole('button', { name: 'Remove Right from image 1' }));
    expect(previewsOf).toHaveBeenLastCalledWith(planOf([[0]]));
    expect(within(card('Image 1')).getByTestId('sheet-preview').querySelectorAll('[data-camera]')).toHaveLength(1);
  });

  it('custom R5 the aux card draws its tile grid as plain squares at the aux canvas aspect', () => {
    setupOverlay({
      activePlan: planOf([[0]], SUNBURST),
      previewsOf: () => [null, { aspect: 1, tiles: Array.from({ length: 12 }, (_, index) => ({ camera: null, x: (index % 4) * 0.25, y: Math.floor(index / 4) * 0.25, w: 0.25, h: 0.25 })) }],
    });
    const preview = within(card('Auxiliary image')).getByTestId('sheet-preview');
    expect(preview.querySelectorAll('[data-aux-tile]')).toHaveLength(12);
    expect(preview.querySelector('img')).toBeNull();
  });
});
