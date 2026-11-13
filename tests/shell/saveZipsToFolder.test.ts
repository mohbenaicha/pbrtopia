import { describe, expect, it, vi } from 'vitest';
import { storeFailure } from '../../src/projects';
import { openZipBatchWriter, uniqueZipName, type FolderEnvironment } from '../../src/shell';

const okWrite = (text: string) => async (sink: WritableStream<Uint8Array>) => {
  const writer = sink.getWriter();
  await writer.write(new TextEncoder().encode(text));
  await writer.close();
  return { ok: true as const, value: text };
};

/** A folder in memory: the files it holds by name, the writes made to it, and what to do when a writable is asked for. */
function fakeFolder(existing: string[] = [], onWritable: (name: string) => void = () => undefined) {
  const files = new Map<string, string>(existing.map((name) => [name, 'old']));
  const handle = {
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (!files.has(name)) {
        if (options?.create !== true) throw new DOMException('no such file', 'NotFoundError');
        files.set(name, '');
      }
      return {
        async createWritable() {
          onWritable(name);
          const chunks: string[] = [];
          return new WritableStream<Uint8Array>({
            write: (chunk) => void chunks.push(new TextDecoder().decode(chunk)),
            close: () => void files.set(name, chunks.join('')),
          });
        },
      };
    },
  };
  return { files, handle };
}

describe('uniqueZipName', () => {
  it('app/projects R17 a name that is free is kept; one that is taken gets (2), (3) before the extension, whatever the case', () => {
    expect(uniqueZipName('Bricks.zip', new Set())).toBe('Bricks.zip');
    expect(uniqueZipName('Bricks.zip', new Set(['bricks.zip']))).toBe('Bricks (2).zip');
    expect(uniqueZipName('Bricks.zip', new Set(['bricks.zip', 'bricks (2).zip']))).toBe('Bricks (3).zip');
  });
});

describe('openZipBatchWriter', () => {
  it('app/projects R17 with a directory picker the zips are written into the folder the user picked, once asked', async () => {
    const { files, handle } = fakeFolder();
    const picker = vi.fn(async () => handle);
    const env: FolderEnvironment = { showDirectoryPicker: picker, saveBlob: vi.fn() };
    const writer = await openZipBatchWriter(env);
    expect(writer?.toFolder).toBe(true);
    expect(await writer!.save('A.zip', okWrite('one'))).toEqual({ ok: true, value: 'one' });
    expect(await writer!.save('B.zip', okWrite('two'))).toEqual({ ok: true, value: 'two' });
    expect(picker).toHaveBeenCalledTimes(1);
    expect(Object.fromEntries(files)).toEqual({ 'A.zip': 'one', 'B.zip': 'two' });
    expect(env.saveBlob).not.toHaveBeenCalled();
  });

  it('app/projects R17 a name taken in the folder, or by an earlier zip of the batch, gets (2), (3)', async () => {
    const { files, handle } = fakeFolder(['Bricks.zip']);
    const writer = await openZipBatchWriter({ showDirectoryPicker: async () => handle, saveBlob: vi.fn() });
    await writer!.save('Bricks.zip', okWrite('one'));
    await writer!.save('Bricks.zip', okWrite('two'));
    expect(Object.fromEntries(files)).toEqual({ 'Bricks.zip': 'old', 'Bricks (2).zip': 'one', 'Bricks (3).zip': 'two' });
  });

  it('app/projects R17 a closed folder picker gives no writer, so nothing is exported', async () => {
    const env: FolderEnvironment = { showDirectoryPicker: async () => { throw new DOMException('closed', 'AbortError'); }, saveBlob: vi.fn() };
    expect(await openZipBatchWriter(env)).toBeNull();
  });

  it('app/projects R17 a write that fails for one project fails that project only', async () => {
    const { handle } = fakeFolder();
    const writer = await openZipBatchWriter({ showDirectoryPicker: async () => handle, saveBlob: vi.fn() });
    const failed = await writer!.save('A.zip', async () => storeFailure('not-found', 'File "x" is missing.'));
    expect(failed).toMatchObject({ ok: false, error: { message: 'File "x" is missing.' } });
    expect(failed.ok === false && 'stopBatch' in failed && failed.stopBatch).toBeFalsy();
    expect(await writer!.save('B.zip', okWrite('two'))).toEqual({ ok: true, value: 'two' });
  });

  it('app/projects R17 a folder that refuses the write stops the batch with "Could not write to the folder."', async () => {
    const { handle } = fakeFolder([], () => {
      throw new DOMException('denied', 'NotAllowedError');
    });
    const writer = await openZipBatchWriter({ showDirectoryPicker: async () => handle, saveBlob: vi.fn() });
    expect(await writer!.save('A.zip', okWrite('one'))).toEqual({ ok: false, error: { code: 'aborted', message: 'Could not write to the folder.' }, stopBatch: true });
  });

  it('app/projects R17 without a directory picker each zip is collected and handed to saveBlob under its own name, one after another', async () => {
    const saved: { name: string; size: number }[] = [];
    const writer = await openZipBatchWriter({ saveBlob: (blob, name) => void saved.push({ name, size: blob.size }) });
    expect(writer?.toFolder).toBe(false);
    await writer!.save('A.zip', okWrite('one'));
    await writer!.save('A.zip', okWrite('three'));
    expect(saved).toEqual([{ name: 'A.zip', size: 3 }, { name: 'A (2).zip', size: 5 }]);
  });

  it('app/projects R17 a failed zip is not handed to saveBlob', async () => {
    const saveBlob = vi.fn();
    const writer = await openZipBatchWriter({ saveBlob });
    expect((await writer!.save('A.zip', async () => storeFailure('aborted', 'No.'))).ok).toBe(false);
    expect(saveBlob).not.toHaveBeenCalled();
  });
});
