import { describe, expect, it, vi } from 'vitest';
import { storeFailure } from '../../src/projects';
import { saveZipFile, zipFileName, type DownloadEnvironment } from '../../src/shell';

const okWrite = () => Promise.resolve({ ok: true as const, value: 'done' });

describe('zipFileName', () => {
  it('materialgen-prep R63 unsafe characters become underscores and an empty name falls back', () => {
    expect(zipFileName('a/b:c', 'x.zip')).toBe('a_b_c.x.zip');
    expect(zipFileName('  ', 'x.zip')).toBe('project.x.zip');
    expect(zipFileName('', 'x.zip', 'material')).toBe('material.x.zip');
  });

  it('materialgen-prep R63 trailing dots and spaces are dropped and a Windows reserved device name gets an underscore', () => {
    expect(zipFileName('Bricks. .', 'x.zip')).toBe('Bricks.x.zip');
    expect(zipFileName('CON', 'x.zip')).toBe('_CON.x.zip');
    expect(zipFileName('nul.txt', 'x.zip')).toBe('_nul.txt.x.zip');
    expect(zipFileName('Console', 'x.zip')).toBe('Console.x.zip');
  });
});

describe('saveZipFile', () => {
  it('materialgen-prep R63 it streams through the picker the user used and names the file', async () => {
    const sink = new WritableStream<Uint8Array>();
    const suggested: string[] = [];
    const env: DownloadEnvironment = { showSaveFilePicker: async (o) => (suggested.push(o.suggestedName), { createWritable: async () => sink }), saveBlob: vi.fn() };
    const write = vi.fn(okWrite);
    expect(await saveZipFile('p.zip', 'A project', write, 'cancelled', env)).toEqual({ ok: true, value: 'done' });
    expect(write).toHaveBeenCalledWith(sink);
    expect(suggested).toEqual(['p.zip']);
    expect(env.saveBlob).not.toHaveBeenCalled();
  });

  it('materialgen-prep R63 without a picker the zip is collected and handed to saveBlob', async () => {
    const saveBlob = vi.fn();
    const write = async (sink: WritableStream<Uint8Array>) => {
      const writer = sink.getWriter();
      await writer.write(new Uint8Array([1, 2, 3]));
      await writer.close();
      return { ok: true as const, value: 'done' };
    };
    await saveZipFile('p.zip', 'A project', write, 'cancelled', { saveBlob });
    expect(saveBlob).toHaveBeenCalledTimes(1);
    const [blob, name] = saveBlob.mock.calls[0] as [Blob, string];
    expect(name).toBe('p.zip');
    expect(blob.size).toBe(3);
  });

  it('materialgen-prep R63 cancelling the picker is not a failure and returns the named value', async () => {
    const write = vi.fn(okWrite);
    const env: DownloadEnvironment = { showSaveFilePicker: async () => Promise.reject(new DOMException('c', 'AbortError')), saveBlob: vi.fn() };
    expect(await saveZipFile('p.zip', 'A', write, 'cancelled', env)).toEqual({ ok: true, value: 'cancelled' });
    expect(write).not.toHaveBeenCalled();
  });

  it('materialgen-prep R63 another picker error is a typed failure, and a failed write is passed on without a download', async () => {
    const denied: DownloadEnvironment = { showSaveFilePicker: async () => Promise.reject(new Error('denied')), saveBlob: vi.fn() };
    const refused = await saveZipFile('p.zip', 'A', vi.fn(okWrite), 'cancelled', denied);
    expect(refused.ok).toBe(false);
    const saveBlob = vi.fn();
    const failed = await saveZipFile('p.zip', 'A', async () => storeFailure('aborted', 'Nope.'), 'cancelled', { saveBlob });
    expect(failed.ok).toBe(false);
    expect(saveBlob).not.toHaveBeenCalled();
  });
});
