// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newMaterialRecord, type MaterialRecord } from '@mat/storage';
import { useReferenceImages } from '@mat/generation/ui/useReferenceImages';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  // jsdom has no decoder: a file whose text is "bad" is not an image, any other is 64 x 32.
  vi.stubGlobal('createImageBitmap', async (blob: Blob) => {
    if ((await blob.text()) === 'bad') throw new Error('not an image');
    return { width: 64, height: 32, close: () => undefined };
  });
});

const base = (): MaterialRecord => newMaterialRecord({ id: 'p1', name: 'Bricks', size: 1024, now: '2026-11-10T09:00:00.000Z' });
const pic = (text: string, name = 'brick.png'): File => new File([text], name, { type: 'image/png' });

function mount(options: { keys?: string[]; canWrite?: boolean; writeOk?: boolean; commitOk?: boolean } = {}) {
  const blobs = new Map<string, Blob>([['references/a', pic('a')]]);
  const store = {
    readBlob: vi.fn(async (_id: string, key: string) => blobs.get(key) ?? null),
    writeBlob: vi.fn(async (_id: string, key: string, blob: Blob) => {
      if (options.writeOk === false) return { ok: false as const, error: { code: 'quota-exceeded', message: 'full' } };
      blobs.set(key, blob);
      return { ok: true as const, value: undefined };
    }),
    deleteBlob: vi.fn(async (_id: string, key: string) => {
      blobs.delete(key);
      return { ok: true as const, value: undefined };
    }),
  };
  let record = { ...base(), referenceImages: options.keys ?? ['references/a'] };
  const commit = vi.fn(async (change: (r: MaterialRecord) => MaterialRecord) => {
    if (options.commitOk === false) return { ok: false as const, error: { code: 'quota-exceeded', message: 'full' } };
    record = change(record);
    return { ok: true as const, value: undefined };
  });
  const hook = renderHook((props: { keys: string[] }) => useReferenceImages({ store: store as never, projectId: 'p1', keys: props.keys, canWrite: options.canWrite ?? true, whenSwept: async () => undefined, commit: commit as never }), {
    initialProps: { keys: record.referenceImages },
  });
  return { ...hook, store, commit, blobs, current: () => record };
}

describe('materialgen/generation reference images', () => {
  it('R39 the project\'s references are read from its files, in order, with their size', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.references).toHaveLength(1));
    expect(result.current.references[0]).toMatchObject({ id: 'references/a', width: 64, height: 32 });
  });

  it('R39 a picked image is written, then listed in the record; one the browser cannot decode is refused with a line', async () => {
    const { result, store, current } = mount();
    await act(async () => result.current.addFiles([pic('new', 'wall.png'), pic('bad', 'notes.txt')]));
    await waitFor(() => expect(current().referenceImages).toHaveLength(2));
    expect(store.writeBlob).toHaveBeenCalledTimes(1);
    expect(current().referenceImages[1]).toMatch(/^references\//);
    await waitFor(() => expect(result.current.notice).toBe('Could not add notes.txt.'));
  });

  it('R39 when the record cannot be stored the written files are deleted again and the user is told', async () => {
    const { result, store, blobs } = mount({ commitOk: false });
    await act(async () => result.current.addFiles([pic('new')]));
    await waitFor(() => expect(result.current.notice).toBe('The reference images could not be saved.'));
    expect(store.deleteBlob).toHaveBeenCalledTimes(1);
    expect([...blobs.keys()]).toEqual(['references/a']);
  });

  it('R39 a file the store cannot write is not listed', async () => {
    const { result, commit } = mount({ writeOk: false });
    await act(async () => result.current.addFiles([pic('new', 'wall.png')]));
    await waitFor(() => expect(result.current.notice).toBe('Could not add wall.png.'));
    expect(commit).not.toHaveBeenCalled();
  });

  it('R39 removing a reference takes it out of the record and then deletes its file', async () => {
    const { result, store, current } = mount();
    await act(async () => result.current.remove('references/a'));
    await waitFor(() => expect(store.deleteBlob).toHaveBeenCalledWith('p1', 'references/a'));
    expect(current().referenceImages).toEqual([]);
  });

  it('R13 in read-only mode adding and removing do nothing', async () => {
    const { result, store, commit } = mount({ canWrite: false });
    await act(async () => {
      result.current.addFiles([pic('new')]);
      result.current.remove('references/a');
    });
    expect(store.writeBlob).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });
});
