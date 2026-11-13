import { describe, expect, it, vi } from 'vitest';
import { storeFailure } from '../../src/projects';
import { createZipListExporter, type DownloadEnvironment, type FolderEnvironment } from '../../src/shell';

interface Outcome {
  dropped: boolean;
}
const CANCELLED: Outcome = { dropped: false };

const writeText = (text: string, outcome: Outcome = { dropped: false }) => async (_project: { id: string; name: string }, sink: WritableStream<Uint8Array>) => {
  const writer = sink.getWriter();
  await writer.write(new TextEncoder().encode(text));
  await writer.close();
  return { ok: true as const, value: outcome };
};

const exporterOf = (write: Parameters<typeof createZipListExporter<Outcome>>[0]['write'], environments: { download?: DownloadEnvironment; folder?: FolderEnvironment }) =>
  createZipListExporter<Outcome>({ extension: 'zip', description: 'Material project', write, whenCancelled: CANCELLED, describe: (outcome) => (outcome.dropped ? 'A file was left out.' : null) }, environments);

/** A save picker that hands out a sink collecting what is written, remembering the suggested name. */
function fakeSavePicker(onClose: (name: string, text: string) => void) {
  return vi.fn(async (options: { suggestedName: string }) => ({
    async createWritable() {
      const chunks: string[] = [];
      return new WritableStream<Uint8Array>({ write: (chunk) => void chunks.push(new TextDecoder().decode(chunk)), close: () => onClose(options.suggestedName, chunks.join('')) });
    },
  }));
}

function fakeFolder() {
  const files = new Map<string, string>();
  return {
    files,
    handle: {
      async getFileHandle(name: string, options?: { create?: boolean }) {
        if (!files.has(name)) {
          if (options?.create !== true) throw new DOMException('no such file', 'NotFoundError');
          files.set(name, '');
        }
        return {
          async createWritable() {
            const chunks: string[] = [];
            return new WritableStream<Uint8Array>({ write: (chunk) => void chunks.push(new TextDecoder().decode(chunk)), close: () => void files.set(name, chunks.join('')) });
          },
        };
      },
    },
  };
}

describe('createZipListExporter exportOne', () => {
  it('app/projects R16 writes <project name>.zip through the save picker and reports done with the note for the outcome', async () => {
    const saved: Record<string, string> = {};
    const picker = fakeSavePicker((name, text) => void (saved[name] = text));
    const exporter = exporterOf(writeText('zip bytes', { dropped: true }), { download: { showSaveFilePicker: picker, saveBlob: vi.fn() } });
    expect(await exporter.exportOne({ id: 'p1', name: 'Bricks' })).toEqual({ kind: 'done', note: 'A file was left out.' });
    expect(saved).toEqual({ 'Bricks.zip': 'zip bytes' });
  });

  it('app/projects R16 a closed save picker is "cancelled", not a failure', async () => {
    const picker = vi.fn(async () => {
      throw new DOMException('closed', 'AbortError');
    });
    const exporter = exporterOf(writeText('x'), { download: { showSaveFilePicker: picker, saveBlob: vi.fn() } });
    expect(await exporter.exportOne({ id: 'p1', name: 'Bricks' })).toEqual({ kind: 'cancelled' });
  });

  it('app/projects R16 a zip that cannot be made is "failed" with the reason', async () => {
    const picker = fakeSavePicker(() => undefined);
    const exporter = exporterOf(async () => storeFailure('not-found', 'File "maps/a.png" is missing.'), { download: { showSaveFilePicker: picker, saveBlob: vi.fn() } });
    expect(await exporter.exportOne({ id: 'p1', name: 'Bricks' })).toEqual({ kind: 'failed', message: 'File "maps/a.png" is missing.' });
  });

  it('app/projects R16 without a save picker the zip goes out as a downloaded link under the project name', async () => {
    const saveBlob = vi.fn();
    const exporter = exporterOf(writeText('abc'), { download: { saveBlob } });
    expect(await exporter.exportOne({ id: 'p1', name: 'a/b' })).toEqual({ kind: 'done', note: null });
    expect(saveBlob).toHaveBeenCalledTimes(1);
    expect(saveBlob.mock.calls[0]![1]).toBe('a_b.zip');
  });
});

describe('createZipListExporter openBatch', () => {
  it('app/projects R17 writes each project into the folder picked once, named <project name>.zip, reporting the note for each', async () => {
    const { files, handle } = fakeFolder();
    const pick = vi.fn(async () => handle);
    const exporter = exporterOf(writeText('zip bytes', { dropped: true }), { folder: { showDirectoryPicker: pick, saveBlob: vi.fn() } });
    const batch = await exporter.openBatch();
    expect(batch?.toFolder).toBe(true);
    expect(await batch!.exportInto({ id: 'a', name: 'Bricks' })).toEqual({ kind: 'done', note: 'A file was left out.' });
    expect(await batch!.exportInto({ id: 'b', name: 'Bricks' })).toEqual({ kind: 'done', note: 'A file was left out.' });
    expect(pick).toHaveBeenCalledTimes(1);
    expect([...files.keys()].sort()).toEqual(['Bricks (2).zip', 'Bricks.zip']);
  });

  it('app/projects R17 a closed folder picker gives no batch', async () => {
    const exporter = exporterOf(writeText('x'), { folder: { showDirectoryPicker: async () => { throw new DOMException('closed', 'AbortError'); }, saveBlob: vi.fn() } });
    expect(await exporter.openBatch()).toBeNull();
  });

  it('app/projects R17 one project that cannot be made fails alone; a folder that refuses writes stops the batch', async () => {
    const { handle } = fakeFolder();
    const exporter = exporterOf(async (project, sink) => (project.id === 'bad' ? storeFailure('not-found', 'File "x" is missing.') : writeText('ok')(project, sink)), { folder: { showDirectoryPicker: async () => handle, saveBlob: vi.fn() } });
    const batch = await exporter.openBatch();
    expect(await batch!.exportInto({ id: 'bad', name: 'Bad' })).toEqual({ kind: 'failed', message: 'File "x" is missing.' });
    expect(await batch!.exportInto({ id: 'good', name: 'Good' })).toEqual({ kind: 'done', note: null });

    const refusing = { async getFileHandle(_name: string, options?: { create?: boolean }) {
      if (options?.create !== true) throw new DOMException('no such file', 'NotFoundError');
      throw new DOMException('denied', 'NotAllowedError');
    } };
    const stopping = await exporterOf(writeText('ok'), { folder: { showDirectoryPicker: async () => refusing, saveBlob: vi.fn() } }).openBatch();
    expect(await stopping!.exportInto({ id: 'a', name: 'A' })).toEqual({ kind: 'failed', message: 'Could not write to the folder.', stopBatch: true });
  });

  it('app/projects R17 without a directory picker the batch is links', async () => {
    const saveBlob = vi.fn();
    const batch = await exporterOf(writeText('abc'), { folder: { saveBlob } }).openBatch();
    expect(batch?.toFolder).toBe(false);
    expect(await batch!.exportInto({ id: 'a', name: 'A' })).toEqual({ kind: 'done', note: null });
    expect(saveBlob).toHaveBeenCalledTimes(1);
  });
});
