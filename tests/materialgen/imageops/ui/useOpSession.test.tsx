// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpSession } from '@mat/imageops/session/opSession';
import type { PixelImage } from '@mat/imageops/gpu/pixelFormats';
import { useOpSession } from '@mat/imageops/ui/useOpSession';

type Values = Record<string, number>;

const image = (value: number): PixelImage => ({ width: 1, height: 1, channels: 1, data: new Uint8Array([value]) });
const DEFAULTS: Values = { amount: 0 };
const isChanged = (values: Values): boolean => values.amount !== 0;

function fakeSession(patch: Partial<OpSession<Values>> = {}): OpSession<Values> & { close: ReturnType<typeof vi.fn> } {
  return {
    size: 8,
    previewSize: 8,
    renderPreview: vi.fn(async (values: Values) => image(values.amount ?? 0)),
    renderFinal: vi.fn(async (values: Values) => image(100 + (values.amount ?? 0))),
    close: vi.fn(),
    ...patch,
  } as OpSession<Values> & { close: ReturnType<typeof vi.fn> };
}

const encode = vi.fn(async (picture: PixelImage) => `blob:${picture.data[0]}`);
const revoke = vi.fn();

function mount(session: OpSession<Values>, open = vi.fn(async () => session), extra: { initial?: Values; previewOnOpen?: boolean } = {}) {
  return { open, ...renderHook(() => useOpSession<Values>({ openSession: open, defaults: DEFAULTS, isChanged, encodePreview: encode, revokePreview: revoke, ...extra })) };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  encode.mockClear();
  revoke.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('imageops/ui useOpSession', () => {
  it('R9 the session opens when the hook mounts and is closed when it unmounts (switching away is Cancel)', async () => {
    const session = fakeSession();
    const { result, unmount } = mount(session);
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    unmount();
    await waitFor(() => expect(session.close).toHaveBeenCalledTimes(1));
  });

  it('R7 a render still running when the dialog closes finishes before the session gives its targets back', async () => {
    let finish: (picture: PixelImage) => void = () => undefined;
    const session = fakeSession({ renderPreview: vi.fn(() => new Promise<PixelImage>((resolve) => { finish = resolve; })) });
    const { result, unmount } = mount(session);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.setValue('amount', 1));
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
    unmount();
    expect(session.close).not.toHaveBeenCalled();
    await act(async () => finish(image(1)));
    await waitFor(() => expect(session.close).toHaveBeenCalledTimes(1));
  });

  it('R9 Apply that finishes after the dialog closed returns nothing, so nothing is committed after a Cancel', async () => {
    let finish: (picture: PixelImage) => void = () => undefined;
    const session = fakeSession({ renderFinal: vi.fn(() => new Promise<PixelImage>((resolve) => { finish = resolve; })) });
    const { result, unmount } = mount(session);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.setValue('amount', 1));
    const commit = vi.fn(async () => true);
    let outcome = true;
    const applying = result.current.apply(commit).then((committed) => { outcome = committed; });
    await act(async () => undefined); // the render starts a tick after Apply is called
    unmount();
    await act(async () => { finish(image(5)); await applying; });
    expect(outcome).toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });

  it('R9 a session that finishes opening after the hook unmounted is closed at once', async () => {
    const session = fakeSession();
    let finish: (value: OpSession<Values>) => void = () => undefined;
    const open = vi.fn(() => new Promise<OpSession<Values>>((resolve) => { finish = resolve; }));
    const { unmount } = mount(session, open);
    unmount();
    await act(async () => finish(session));
    expect(session.close).toHaveBeenCalledTimes(1);
  });

  it('R16 Apply is possible only once a value differs from its default', async () => {
    const { result } = mount(fakeSession());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.canApply).toBe(false);
    act(() => result.current.setValue('amount', 2));
    expect(result.current.canApply).toBe(true);
    act(() => result.current.reset());
    expect(result.current.canApply).toBe(false);
  });

  it('R18 five changes within 75 ms render one preview, with the last values', async () => {
    const session = fakeSession();
    const { result } = mount(session);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => { for (const value of [1, 2, 3, 4, 5]) result.current.setValue('amount', value); });
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
    await waitFor(() => expect(result.current.previewUrl).toBe('blob:5'));
    expect(session.renderPreview).toHaveBeenCalledTimes(1);
    expect(session.renderPreview).toHaveBeenCalledWith({ amount: 5 });
  });

  it('R18 a preview that finishes after a newer change is not shown', async () => {
    const pending: Array<(picture: PixelImage) => void> = [];
    const session = fakeSession({ renderPreview: vi.fn(() => new Promise<PixelImage>((resolve) => pending.push(resolve))) });
    const { result } = mount(session);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.setValue('amount', 1));
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
    act(() => result.current.setValue('amount', 2));
    await act(async () => { pending[0]!(image(1)); });
    expect(result.current.previewUrl).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
    await act(async () => { pending[1]!(image(2)); });
    await waitFor(() => expect(result.current.previewUrl).toBe('blob:2'));
  });

  it('R18 a replaced preview picture is released', async () => {
    const { result } = mount(fakeSession());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.setValue('amount', 1));
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
    await waitFor(() => expect(result.current.previewUrl).toBe('blob:1'));
    act(() => result.current.setValue('amount', 2));
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
    await waitFor(() => expect(result.current.previewUrl).toBe('blob:2'));
    expect(revoke).toHaveBeenCalledWith('blob:1');
  });

  it('R19 Apply renders at S from the current values, never from the preview image', async () => {
    const session = fakeSession();
    const { result } = mount(session);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.setValue('amount', 3));
    const commit = vi.fn<(picture: PixelImage) => Promise<boolean>>(async () => true);
    let committed = false;
    await act(async () => { committed = await result.current.apply(commit); });
    expect(session.renderFinal).toHaveBeenCalledWith({ amount: 3 });
    expect(commit.mock.calls[0]![0].data[0]).toBe(103);
    expect(committed).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('R12 applying stays on until the commit has finished, and a second Apply meanwhile commits nothing more', async () => {
    const session = fakeSession();
    const { result } = mount(session);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.setValue('amount', 3));
    let finish: (stored: boolean) => void = () => undefined;
    const commit = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    let first: Promise<boolean> = Promise.resolve(false);
    await act(async () => { first = result.current.apply(commit); });
    await waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    expect(result.current.applying).toBe(true);
    let second = true;
    await act(async () => { second = await result.current.apply(commit); });
    expect(second).toBe(false);
    expect(commit).toHaveBeenCalledTimes(1);
    await act(async () => { finish(true); await first; });
    expect(result.current.applying).toBe(false);
  });

  it('R12 a commit that is refused or fails says nothing changed and leaves the session open', async () => {
    const session = fakeSession();
    const { result } = mount(session);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.setValue('amount', 3));
    await act(async () => { await result.current.apply(async () => false); });
    expect(result.current.error).toBe('Could not save the result. Nothing changed.');
    await act(async () => { await result.current.apply(async () => { throw new Error('disk'); }); });
    expect(result.current.error).toBe('Could not save the result. Nothing changed.');
    expect(result.current.applying).toBe(false);
    expect(session.close).not.toHaveBeenCalled();
  });

  it('R12 a render error during Apply returns nothing, keeps the session open and says nothing changed', async () => {
    const session = fakeSession({ renderFinal: vi.fn(async () => { throw new Error('lost context'); }) });
    const { result } = mount(session);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.setValue('amount', 3));
    const commit = vi.fn(async () => true);
    let committed = true;
    await act(async () => { committed = await result.current.apply(commit); });
    expect(committed).toBe(false);
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Could not apply (graphics error). Nothing changed.');
    expect(result.current.status).toBe('ready');
    expect(result.current.applying).toBe(false);
    expect(session.close).not.toHaveBeenCalled();
  });

  it('R12 a session that cannot be opened is reported as failed', async () => {
    const open = vi.fn(async () => { throw new Error('no graphics'); });
    const { result } = mount(fakeSession(), open);
    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.canApply).toBe(false);
  });

  it('R43 a tool that starts from remembered values previews them as soon as the session is open, and Reset still goes to the defaults', async () => {
    const session = fakeSession();
    const { result } = mount(session, undefined, { initial: { amount: 7 }, previewOnOpen: true });
    expect(result.current.values).toEqual({ amount: 7 });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
    await waitFor(() => expect(result.current.previewUrl).toBe('blob:7'));
    expect(session.renderPreview).toHaveBeenCalledWith({ amount: 7 });
    act(() => result.current.reset());
    expect(result.current.values).toEqual(DEFAULTS);
  });

  it('R18 without previewOnOpen nothing is rendered until a control changes', async () => {
    const session = fakeSession();
    const { result } = mount(session);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(session.renderPreview).not.toHaveBeenCalled();
  });

  it('R18 Reset puts every control back to its default and shows a preview of the source again', async () => {
    const session = fakeSession();
    const { result } = mount(session);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.setValue('amount', 4));
    act(() => result.current.reset());
    expect(result.current.values).toEqual(DEFAULTS);
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
    expect(session.renderPreview).toHaveBeenLastCalledWith(DEFAULTS);
  });
});
