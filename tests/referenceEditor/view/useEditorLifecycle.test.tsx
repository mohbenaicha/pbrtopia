// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { selectRect } from '../../../src/referenceEditor/ops/selectRect';
import { createRaster } from '../../../src/referenceEditor/model/raster';
import { decodeToRaster } from '../../../src/referenceEditor/io/decodeToRaster';
import { APPLY_ERROR, OPEN_ERROR, useEditorLifecycle } from '../../../src/referenceEditor/view/useEditorLifecycle';

vi.mock('../../../src/referenceEditor/io/decodeToRaster', () => ({ decodeToRaster: vi.fn() }));
const decode = vi.mocked(decodeToRaster);

const open = (encode: () => Promise<Blob>) => {
  const onApply = vi.fn();
  const onClose = vi.fn();
  const hook = renderHook(() => useEditorLifecycle({ source: new Blob(['s']), width: 8, height: 8, encode, onApply, onClose }));
  return { ...hook, onApply, onClose };
};

/** Gives the open editor one pixel-changing step: a selected rectangle, filled. */
function changePixels(doc: NonNullable<ReturnType<typeof open>['result']['current']['doc']>): void {
  const journal = doc.beginJournal();
  selectRect(doc.mask, { x: 0, y: 0, w: 8, h: 8 }, journal);
  doc.push({ kind: 'tiles', journal, changesPixels: false });
  doc.fill(0xff0000ff);
}

beforeEach(() => { decode.mockReset(); vi.useRealTimers(); });
afterEach(cleanup);

describe('useEditorLifecycle (reference-editor R4, R15, R16)', () => {
  it('R4 decodes once on open and becomes ready with a document', async () => {
    decode.mockResolvedValue(createRaster(8, 8));
    const { result } = open(async () => new Blob(['p']));
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(decode).toHaveBeenCalledTimes(1);
    expect(result.current.doc?.raster.width).toBe(8);
  });

  it('R4 a picture that cannot be decoded says so and then closes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    decode.mockRejectedValue(new Error('bad'));
    const { result, onClose } = open(async () => new Blob(['p']));
    await waitFor(() => expect(result.current.message).toBe(OPEN_ERROR));
    expect(result.current.state).toBe('failedOpen');
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('R15 Apply with no pixel change closes without applying', async () => {
    decode.mockResolvedValue(createRaster(8, 8));
    const encode = vi.fn(async () => new Blob(['p']));
    const { result, onApply, onClose } = open(encode);
    await waitFor(() => expect(result.current.state).toBe('ready'));
    act(() => result.current.apply());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(encode).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('R15 Apply after a pixel change encodes once and emits the edit with the working size', async () => {
    decode.mockResolvedValue(createRaster(8, 8));
    const png = new Blob(['p']);
    const encode = vi.fn(async () => png);
    const { result, onApply, onClose } = open(encode);
    await waitFor(() => expect(result.current.state).toBe('ready'));
    act(() => changePixels(result.current.doc!));
    act(() => result.current.apply());
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(onApply).toHaveBeenCalledWith({ blob: png, width: 8, height: 8 });
    expect(encode).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('R16 a failed encode keeps the editor open with its history and shows the error; a retry works', async () => {
    decode.mockResolvedValue(createRaster(8, 8));
    const encode = vi.fn<() => Promise<Blob>>().mockRejectedValueOnce(new Error('no')).mockResolvedValueOnce(new Blob(['p']));
    const { result, onApply } = open(encode);
    await waitFor(() => expect(result.current.state).toBe('ready'));
    act(() => changePixels(result.current.doc!));
    act(() => result.current.apply());
    await waitFor(() => expect(result.current.message).toBe(APPLY_ERROR));
    expect(result.current.state).toBe('ready');
    expect(result.current.doc?.canUndo).toBe(true);
    act(() => result.current.apply());
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
  });

  it('R15 Cancel writes nothing and closes', async () => {
    decode.mockResolvedValue(createRaster(8, 8));
    const { result, onApply, onClose } = open(async () => new Blob(['p']));
    await waitFor(() => expect(result.current.state).toBe('ready'));
    act(() => changePixels(result.current.doc!));
    act(() => result.current.cancel());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onApply).not.toHaveBeenCalled();
  });

  it('R15 Cancel while applying drops the late result', async () => {
    decode.mockResolvedValue(createRaster(8, 8));
    let finish: (blob: Blob) => void = () => undefined;
    const encode = vi.fn(() => new Promise<Blob>((resolve) => { finish = resolve; }));
    const { result, onApply, onClose } = open(encode);
    await waitFor(() => expect(result.current.state).toBe('ready'));
    act(() => changePixels(result.current.doc!));
    act(() => result.current.apply());
    await waitFor(() => expect(result.current.state).toBe('applying'));
    act(() => result.current.cancel());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    await act(async () => { finish(new Blob(['late'])); });
    expect(onApply).not.toHaveBeenCalled();
  });

  it('R4 a decode that finishes after Cancel is ignored', async () => {
    let finish: (raster: ReturnType<typeof createRaster>) => void = () => undefined;
    decode.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result, onClose } = open(async () => new Blob(['p']));
    act(() => result.current.cancel());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    await act(async () => { finish(createRaster(8, 8)); });
    expect(result.current.doc).toBeNull();
    expect(result.current.state).toBe('closed');
  });
});
