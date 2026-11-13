import { describe, expect, it } from 'vitest';
import { saveZipFile } from '../../../src/shell/saveZipFile';
import { openZipBatchWriter } from '../../../src/shell/saveZipsToFolder';
import { MAX_CHUNK_BYTES } from '../../../src/storage-desktop/FileBridge';
import { createTauriDialogs } from '../../../src/storage-desktop/tauri/tauriDialogs';
import type { InvokeOptions } from '../../../src/storage-desktop/tauri/tauriInvoke';

interface Call {
  command: string;
  args: unknown;
  headers: Record<string, string>;
}

/** A scripted desktop side: answers the dialog commands, records every call, and holds the files that exist in the picked folder. */
function scriptedDesktop(script: { saveHandle?: string | null; folderHandle?: string | null; existing?: string[]; failWith?: unknown } = {}) {
  const calls: Call[] = [];
  const existing = new Set((script.existing ?? []).map((name) => name.toLowerCase()));
  const created: string[] = [];
  const invoke = async (command: string, args?: unknown, options?: InvokeOptions): Promise<unknown> => {
    calls.push({ command, args, headers: options?.headers ?? {} });
    if (script.failWith !== undefined && (command === 'handle_create_file' || command === 'handle_write_chunk')) throw script.failWith;
    switch (command) {
      case 'pick_save_file':
        return script.saveHandle === undefined ? 'save-1' : script.saveHandle;
      case 'pick_folder':
        return script.folderHandle === undefined ? 'folder-1' : script.folderHandle;
      case 'handle_folder_has':
        return existing.has(((args as { name: string }).name).toLowerCase());
      case 'handle_create_file': {
        const name = (args as { name: string }).name;
        created.push(name);
        return `file-${created.length}`;
      }
      default:
        return undefined;
    }
  };
  return { invoke, calls, created };
}

const names = (calls: Call[]): string[] => calls.map((call) => call.command);

describe('the desktop save dialog (storage-backends R13)', () => {
  it('R13 a closed Save dialog is an AbortError, which saveZipFile reports as a cancel and not a failure', async () => {
    const desktop = scriptedDesktop({ saveHandle: null });
    const dialogs = createTauriDialogs(desktop.invoke);
    const outcome = await saveZipFile('Bricks.zip', 'Material project', async () => ({ ok: true, value: 'written' }), 'cancelled', { showSaveFilePicker: dialogs.showSaveFilePicker, saveBlob: () => undefined });
    expect(outcome).toEqual({ ok: true, value: 'cancelled' });
  });

  it('R13 the dialog is opened with the suggested name and the file description, and writing goes through the handle in order', async () => {
    const desktop = scriptedDesktop();
    const dialogs = createTauriDialogs(desktop.invoke);
    const file = await dialogs.showSaveFilePicker({ suggestedName: 'Bricks.zip', types: [{ description: 'Material project', accept: { 'application/zip': ['.zip'] } }] });
    const sink = await file.createWritable();
    const writer = sink.getWriter();
    await writer.write(new Uint8Array([1, 2]));
    await writer.write(new Uint8Array([3]));
    await writer.close();
    expect(desktop.calls[0]).toMatchObject({ command: 'pick_save_file', args: { suggestedName: 'Bricks.zip', description: 'Material project' } });
    const writes = desktop.calls.filter((call) => call.command === 'handle_write_chunk');
    expect(writes.map((call) => [...(call.args as Uint8Array)])).toEqual([[1, 2], [3]]);
    expect(writes.every((call) => call.headers.handle === 'save-1')).toBe(true);
    expect(names(desktop.calls).slice(-1)).toEqual(['handle_commit']);
    expect(desktop.calls.at(-1)?.args).toEqual({ handle: 'save-1' });
  });

  it('R13 a write larger than one chunk is sent in chunks of at most 8 MB', async () => {
    const desktop = scriptedDesktop();
    const file = await createTauriDialogs(desktop.invoke).showSaveFilePicker({ suggestedName: 'a.zip', types: [{ description: 'Zip', accept: {} }] });
    const writer = (await file.createWritable()).getWriter();
    await writer.write(new Uint8Array(MAX_CHUNK_BYTES + 5));
    await writer.close();
    const sizes = desktop.calls.filter((call) => call.command === 'handle_write_chunk').map((call) => (call.args as Uint8Array).length);
    expect(sizes).toEqual([MAX_CHUNK_BYTES, 5]);
  });

  it('R13 an aborted stream abandons the file through the handle, and nothing is committed', async () => {
    const desktop = scriptedDesktop();
    const file = await createTauriDialogs(desktop.invoke).showSaveFilePicker({ suggestedName: 'a.zip', types: [{ description: 'Zip', accept: {} }] });
    const writer = (await file.createWritable()).getWriter();
    await writer.write(new Uint8Array([1]));
    await writer.abort('stop');
    expect(names(desktop.calls)).toContain('handle_abort');
    expect(names(desktop.calls)).not.toContain('handle_commit');
  });
});

describe('the desktop folder dialog (storage-backends R13)', () => {
  it('R13 a closed folder dialog is an AbortError, which openZipBatchWriter reports as null so nothing is exported', async () => {
    const desktop = scriptedDesktop({ folderHandle: null });
    const dialogs = createTauriDialogs(desktop.invoke);
    expect(await openZipBatchWriter({ showDirectoryPicker: dialogs.showDirectoryPicker, saveBlob: () => undefined })).toBeNull();
  });

  it('R13 zips in one folder are named "Bricks.zip", "Bricks (2).zip" and a name already in the folder is not overwritten', async () => {
    const desktop = scriptedDesktop({ existing: ['Bricks.zip'] });
    const dialogs = createTauriDialogs(desktop.invoke);
    const batch = await openZipBatchWriter({ showDirectoryPicker: dialogs.showDirectoryPicker, saveBlob: () => undefined });
    if (batch === null) throw new Error('the dialog should have opened');
    expect(batch.toFolder).toBe(true);
    for (let n = 0; n < 2; n += 1) {
      const saved = await batch.save('Bricks.zip', async (sink) => {
        const writer = sink.getWriter();
        await writer.write(new Uint8Array([9]));
        await writer.close();
        return { ok: true, value: n };
      });
      expect(saved.ok).toBe(true);
    }
    expect(desktop.created).toEqual(['Bricks (2).zip', 'Bricks (3).zip']);
    expect(desktop.calls.filter((call) => call.command === 'handle_commit')).toHaveLength(2);
  });

  it('R13 the folder is asked once for the whole batch and the page only ever holds opaque handles', async () => {
    const desktop = scriptedDesktop();
    const dialogs = createTauriDialogs(desktop.invoke);
    const batch = await openZipBatchWriter({ showDirectoryPicker: dialogs.showDirectoryPicker, saveBlob: () => undefined });
    await batch?.save('A.zip', async () => ({ ok: true, value: 1 }));
    await batch?.save('B.zip', async () => ({ ok: true, value: 2 }));
    expect(names(desktop.calls).filter((command) => command === 'pick_folder')).toHaveLength(1);
    expect(JSON.stringify(desktop.calls.map((call) => call.args))).not.toMatch(/[A-Za-z]:\\/);
  });

  it('R13 a folder the desktop side refuses to write to stops the batch with the folder message', async () => {
    const desktop = scriptedDesktop({ failWith: { kind: 'denied', message: 'Windows did not allow writing there.' } });
    const dialogs = createTauriDialogs(desktop.invoke);
    const batch = await openZipBatchWriter({ showDirectoryPicker: dialogs.showDirectoryPicker, saveBlob: () => undefined });
    const saved = await batch?.save('A.zip', async () => ({ ok: true, value: 1 }));
    expect(saved).toMatchObject({ ok: false, stopBatch: true, error: { message: 'Could not write to the folder.' } });
  });

  it('R13 a new batch gives the previous folder handle back to the desktop side', async () => {
    const desktop = scriptedDesktop();
    const dialogs = createTauriDialogs(desktop.invoke);
    await dialogs.showDirectoryPicker();
    await dialogs.showDirectoryPicker();
    const releases = desktop.calls.filter((call) => call.command === 'handle_release');
    expect(releases).toHaveLength(1);
    expect(releases[0]?.args).toEqual({ handle: 'folder-1' });
  });
});
