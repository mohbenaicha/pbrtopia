import { describe, expect, it } from 'vitest';
import { createDesktopRecordEngine } from '@shared/storage-desktop';
import { createMemoryRecordBridge } from '../../support/storageDesktop/memoryRecordBridge';
import { createDesktopMaterialDatabase } from '@mat/storage/desktopMaterialDatabase';
import type { MaterialRecord } from '@mat/storage';

const record = (id: string, updatedAt: string): MaterialRecord => ({ id, name: `Material ${id}`, updatedAt }) as unknown as MaterialRecord;
const ALL = ['projects', 'thumbnails', 'settings'] as never;

function open() {
  const bridge = createMemoryRecordBridge();
  return { bridge, database: createDesktopMaterialDatabase(createDesktopRecordEngine(bridge)) };
}

describe('createDesktopMaterialDatabase (storage-backends R5, R9)', () => {
  it('R5 a material project is stored as JSON, read back by id, undefined when missing, and listed newest change first with ties by id largest first', async () => {
    const { bridge, database } = open();
    await database.run(ALL, 'readwrite', async (tx) => {
      await tx.putProject(record('a', '2026-01-01T00:00:00.000Z'));
      await tx.putProject(record('b', '2026-03-01T00:00:00.000Z'));
      await tx.putProject(record('c', '2026-03-01T00:00:00.000Z'));
    });
    expect(JSON.parse(new TextDecoder().decode((await bridge.get('projects', 'a'))!))).toMatchObject({ id: 'a' });
    const read = await database.run(ALL, 'readonly', async (tx) => ({ one: await tx.get('projects', 'b'), none: await tx.get('projects', 'z'), list: await tx.listProjectsNewestFirst() }));
    expect(read.ok && read.value.one).toEqual(record('b', '2026-03-01T00:00:00.000Z'));
    expect(read.ok && read.value.none).toBeUndefined();
    expect(read.ok && (read.value.list as { id: string }[]).map((entry) => entry.id)).toEqual(['c', 'b', 'a']);
  });

  it('R5 settings and a thumbnail round-trip, and remove takes them out', async () => {
    const { database } = open();
    await database.run(ALL, 'readwrite', async (tx) => {
      await tx.putAt('settings', 'app', { previewPrefs: { mesh: 'ball' } });
      await tx.putAt('thumbnails', 'a', new Blob([Uint8Array.from([5, 6])], { type: 'image/jpeg' }));
    });
    const read = await database.run(ALL, 'readonly', async (tx) => ({ settings: await tx.get('settings', 'app'), thumbnail: await tx.get('thumbnails', 'a') }));
    expect(read.ok && read.value.settings).toEqual({ previewPrefs: { mesh: 'ball' } });
    expect(read.ok && [...new Uint8Array(await read.value.thumbnail!.arrayBuffer())]).toEqual([5, 6]);
    await database.run(ALL, 'readwrite', async (tx) => {
      await tx.remove('thumbnails', 'a');
      await tx.remove('settings', 'app');
    });
    const after = await database.run(ALL, 'readonly', async (tx) => [await tx.get('thumbnails', 'a'), await tx.get('settings', 'app')]);
    expect(after).toEqual({ ok: true, value: [undefined, undefined] });
  });

  it('R5 a record holding bytes is refused as "corrupt" and the run saves nothing', async () => {
    const { bridge, database } = open();
    const result = await database.run(ALL, 'readwrite', async (tx) => {
      await tx.putProject(record('ok', '2026-01-01T00:00:00.000Z'));
      await tx.putProject({ ...record('bad', '2026-01-02T00:00:00.000Z'), data: new Uint8Array(1) } as never);
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'corrupt' } });
    expect(await bridge.get('projects', 'ok')).toBeNull();
  });

  it('R9 a project whose stored bytes are not valid JSON is read and listed as a bare { id } so it shows as unreadable; damaged settings read as empty', async () => {
    const { bridge, database } = open();
    const garbage = Uint8Array.from([0xff, 0x00]);
    await bridge.commit([
      { op: 'put', collection: 'projects', key: 'broken', sort: '2026-05-01T00:00:00.000Z', value: garbage },
      { op: 'put', collection: 'settings', key: 'app', value: garbage },
    ]);
    const result = await database.run(ALL, 'readonly', async (tx) => ({ list: await tx.listProjectsNewestFirst(), one: await tx.get('projects', 'broken'), settings: await tx.get('settings', 'app') }));
    expect(result).toEqual({ ok: true, value: { list: [{ id: 'broken' }], one: { id: 'broken' }, settings: {} } });
  });

  it('R7 a reading run cannot write and a throwing run saves nothing', async () => {
    const { bridge, database } = open();
    expect(await database.run(ALL, 'readonly', (tx) => tx.putProject(record('a', '2026-01-01T00:00:00.000Z')))).toMatchObject({ ok: false });
    await database.run(ALL, 'readwrite', async (tx) => {
      await tx.putProject(record('a', '2026-01-01T00:00:00.000Z'));
      throw new Error('stop');
    });
    expect(await bridge.get('projects', 'a')).toBeNull();
  });
});
