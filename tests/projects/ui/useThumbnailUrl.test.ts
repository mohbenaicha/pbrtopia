// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThumbnailUrl } from '../../../src/projects/ui/useThumbnailUrl';

let count = 0;
const createObjectURL = vi.fn(() => `blob:thumb-${++count}`);
const revokeObjectURL = vi.fn();

beforeEach(() => {
  count = 0;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  URL.createObjectURL = createObjectURL as never;
  URL.revokeObjectURL = revokeObjectURL as never;
});
afterEach(cleanup);

const blob = (): Blob => new Blob(['jpg'], { type: 'image/jpeg' });

describe('useThumbnailUrl', () => {
  it('projects R7 a stored thumbnail becomes an address once it is loaded', async () => {
    const load = vi.fn(async () => blob());
    const { result } = renderHook(() => useThumbnailUrl(load, 'a'));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe('blob:thumb-1'));
    expect(load).toHaveBeenCalledWith('a');
  });

  it('projects R7 a project without a thumbnail stays without an address', async () => {
    const load = vi.fn(async () => null);
    const { result } = renderHook(() => useThumbnailUrl(load, 'a'));
    await act(async () => undefined);
    expect(result.current).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('projects R10 the address is released when the card goes away', async () => {
    const load = vi.fn(async () => blob());
    const { result, unmount } = renderHook(() => useThumbnailUrl(load, 'a'));
    await waitFor(() => expect(result.current).not.toBeNull());
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:thumb-1');
  });

  it('projects R10 a thumbnail that arrives after the card went away leaves no address behind', async () => {
    let arrive: (picture: Blob) => void = () => undefined;
    const load = vi.fn(() => new Promise<Blob>((resolve) => void (arrive = resolve)));
    const { unmount } = renderHook(() => useThumbnailUrl(load, 'a'));
    unmount();
    await act(async () => arrive(blob()));
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('projects R7 another project\'s card loads its own thumbnail and releases the previous address', async () => {
    const load = vi.fn(async () => blob());
    const { result, rerender } = renderHook((props: { id: string }) => useThumbnailUrl(load, props.id), { initialProps: { id: 'a' } });
    await waitFor(() => expect(result.current).toBe('blob:thumb-1'));
    rerender({ id: 'b' });
    await waitFor(() => expect(result.current).toBe('blob:thumb-2'));
    expect(load).toHaveBeenLastCalledWith('b');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:thumb-1');
  });
});
