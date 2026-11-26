// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditDocument } from '../../../src/referenceEditor/document/EditDocument';
import { createRaster } from '../../../src/referenceEditor/model/raster';
import { CanvasStage } from '../../../src/referenceEditor/view/CanvasStage';

beforeEach(() => {
  const context = { putImageData: vi.fn(), save: vi.fn(), restore: vi.fn(), strokeRect: vi.fn(), setLineDash: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as ReturnType<HTMLCanvasElement['getContext']>);
  vi.stubGlobal('ImageData', class { constructor(readonly data: Uint8ClampedArray, readonly width: number, readonly height: number) {} });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function open() {
  const onBrushSize = vi.fn<(size: number) => void>();
  const view = render(
    <CanvasStage
      doc={EditDocument.create(createRaster(64, 64))}
      settings={{ tool: 'paint', colour: 0xff000000, brushSize: 24 }}
      onChanged={vi.fn()}
      onBrushStep={vi.fn()}
      onBrushSize={onBrushSize}
      handleRef={{ current: null }}
    />,
  );
  const stage = view.container.querySelector('.reference-editor__stage')!;
  const ring = view.container.querySelector<HTMLElement>('.reference-editor__ghost')!;
  const move = (clientX: number, shiftKey: boolean) => stage.dispatchEvent(new MouseEvent('pointermove', { clientX, clientY: 50, shiftKey }));
  const ringCentreX = () => Number(/translate\((-?[\d.]+)px/.exec(ring.style.transform)![1]) + Number.parseFloat(ring.style.width) / 2;
  return { move, ringCentreX, onBrushSize };
}

describe('CanvasStage brush ring (reference-editor R6)', () => {
  it('R6 the ring follows the pointer', () => {
    const { move, ringCentreX } = open();
    move(100, false);
    expect(ringCentreX()).toBeCloseTo(100, 0);
    move(160, false);
    expect(ringCentreX()).toBeCloseTo(160, 0);
  });

  it('R6 the ring stays where it was while Shift-move changes the size, and returns to the pointer without Shift', () => {
    const { move, ringCentreX, onBrushSize } = open();
    move(100, false);
    move(160, true);
    expect(ringCentreX()).toBeCloseTo(100, 0);
    expect(onBrushSize).toHaveBeenLastCalledWith(50);
    move(161, false);
    expect(ringCentreX()).toBeCloseTo(161, 0);
  });
});
