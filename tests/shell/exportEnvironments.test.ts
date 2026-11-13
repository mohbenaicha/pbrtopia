import { describe, expect, it, vi } from 'vitest';
import { exportEnvironments } from '../../src/shell/exportEnvironments';
import { saveZipFile } from '../../src/shell/saveZipFile';

describe('exportEnvironments (storage-backends R13)', () => {
  it('R13 with no desktop pickers (the browser) it is empty, so the writers use the browser\'s own pickers', () => {
    expect(exportEnvironments(undefined)).toEqual({});
  });

  it('R13 with the desktop pickers, the save and folder environments use them, and a save goes through the native Save dialog', async () => {
    const write = vi.fn(async () => undefined);
    const pickers = {
      showSaveFilePicker: vi.fn(async () => ({ createWritable: async () => new WritableStream<Uint8Array>({ write }) })),
      showDirectoryPicker: vi.fn(),
    };
    const environments = exportEnvironments(pickers);
    expect(environments.folder?.showDirectoryPicker).toBe(pickers.showDirectoryPicker);
    const saved = await saveZipFile('Bricks.zip', 'Material project', async (sink) => {
      const writer = sink.getWriter();
      await writer.write(new Uint8Array([1]));
      await writer.close();
      return { ok: true, value: 'done' };
    }, 'cancelled', environments.download);
    expect(saved).toEqual({ ok: true, value: 'done' });
    expect(pickers.showSaveFilePicker).toHaveBeenCalledWith({ suggestedName: 'Bricks.zip', types: [{ description: 'Material project', accept: { 'application/zip': ['.zip'] } }] });
    expect(write).toHaveBeenCalledOnce();
  });
});
