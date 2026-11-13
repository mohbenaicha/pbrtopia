import type { FileBridge, FileWriter } from '../../../src/storage-desktop/FileBridge';
import type { RecordBridge, RecordOp } from '../../../src/storage-desktop/RecordBridge';
import type { InvokeOptions, TauriInvoke } from '../../../src/storage-desktop/tauri/tauriInvoke';

/** Every call the page made, in order. */
export interface RecordedCall {
  command: string;
  args: unknown;
  headers: Record<string, string> | undefined;
}

export interface FakeTauri {
  invoke: TauriInvoke;
  calls: RecordedCall[];
}

export interface FakeTauriParts {
  records: RecordBridge;
  library: FileBridge;
  appdata: FileBridge;
  /** The `library_*` commands, answered by the test. */
  libraryCommands?: Record<string, (args: unknown) => unknown>;
}

const toBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
const failure = (kind: string, message: string): { kind: string; message: string } => ({ kind, message });

/** The data-model wire format read again here from the documentation, not from the code under test: [u32 LE header length][JSON header][payloads]. */
function readFrame(body: Uint8Array): { header: Array<Record<string, unknown>>; payloads: Uint8Array } {
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const headerLength = view.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(body.subarray(4, 4 + headerLength))) as Array<Record<string, unknown>>;
  return { header, payloads: body.subarray(4 + headerLength) };
}

function writeFrame(items: Array<Record<string, unknown>>, payloads: Uint8Array[]): Uint8Array {
  const header = new TextEncoder().encode(JSON.stringify(items));
  const out = new Uint8Array(4 + header.length + payloads.reduce((total, piece) => total + piece.length, 0));
  new DataView(out.buffer).setUint32(0, header.length, true);
  out.set(header, 4);
  let at = 4 + header.length;
  for (const piece of payloads) {
    out.set(piece, at);
    at += piece.length;
  }
  return out;
}

/** A page-side stand-in for Tauri's `invoke` that answers like the Rust commands do (same wire shapes), over in-memory and node-fs bridges. */
export function createFakeTauriInvoke(parts: FakeTauriParts): FakeTauri {
  const calls: RecordedCall[] = [];
  const writers = new Map<string, FileWriter>();
  let nextWriteId = 1;
  const filesOf = (root: unknown): FileBridge => (root === 'appdata' ? parts.appdata : parts.library);

  async function readWhole(files: FileBridge, path: string): Promise<Uint8Array | null> {
    const chunks = await files.read(path);
    if (chunks === null) return null;
    const pieces: Uint8Array[] = [];
    for await (const piece of chunks) pieces.push(piece);
    const whole = new Uint8Array(pieces.reduce((total, piece) => total + piece.length, 0));
    let at = 0;
    for (const piece of pieces) {
      whole.set(piece, at);
      at += piece.length;
    }
    return whole;
  }

  async function run(command: string, args: unknown, options: InvokeOptions | undefined): Promise<unknown> {
    const named = (args ?? {}) as Record<string, unknown>;
    const headers = options?.headers ?? {};
    switch (command) {
      case 'db_get': {
        const value = await parts.records.get(named['collection'] as string, named['key'] as string);
        return toBuffer(value === null ? new Uint8Array([0]) : new Uint8Array([1, ...value]));
      }
      case 'db_list': {
        const parent = named['parent'];
        const entries = await parts.records.list(named['collection'] as string, typeof parent === 'string' ? { by: 'parent', parent } : { by: 'sortDescending' });
        return toBuffer(writeFrame(entries.map((entry) => ({ key: entry.key, ...(entry.parent === undefined ? {} : { parent: entry.parent }), ...(entry.sort === undefined ? {} : { sort: entry.sort }), length: entry.value.length })), entries.map((entry) => entry.value)));
      }
      case 'db_commit': {
        const { header, payloads } = readFrame(args as Uint8Array);
        let at = 0;
        const ops: RecordOp[] = header.map((item) => {
          const collection = item['collection'] as string;
          if (item['op'] === 'put') {
            const length = item['length'] as number;
            const value = payloads.slice(at, at + length);
            at += length;
            return { op: 'put', collection, key: item['key'] as string, ...(item['parent'] === undefined ? {} : { parent: item['parent'] as string }), ...(item['sort'] === undefined ? {} : { sort: item['sort'] as string }), value };
          }
          if (item['op'] === 'remove') return { op: 'remove', collection, key: item['key'] as string };
          return { op: 'removeByParent', collection, parent: item['parent'] as string };
        });
        await parts.records.commit(ops);
        return null;
      }
      case 'file_read_chunk': {
        const whole = await readWhole(filesOf(named['root']), named['path'] as string);
        if (whole === null) return toBuffer(new Uint8Array([0]));
        const piece = whole.subarray(named['offset'] as number, (named['offset'] as number) + (named['max'] as number));
        return toBuffer(new Uint8Array([1, ...piece]));
      }
      case 'file_write_begin': {
        const id = nextWriteId++;
        writers.set(`${String(named['root'])}:${id}`, await filesOf(named['root']).write(named['path'] as string));
        return id;
      }
      case 'file_write_chunk':
        await writers.get(`${headers['root']}:${headers['id']}`)!.chunk(args as Uint8Array);
        return null;
      case 'file_write_commit':
        await writers.get(`${String(named['root'])}:${String(named['id'])}`)!.commit();
        return null;
      case 'file_write_abort':
        await writers.get(`${String(named['root'])}:${String(named['id'])}`)!.abort();
        return null;
      case 'file_remove':
        await filesOf(named['root']).remove(named['path'] as string, named['recursive'] as boolean);
        return null;
      case 'file_list':
        return parts.library.list(named['path'] as string);
      case 'file_free_space':
        return parts.library.freeSpace();
      default: {
        const handler = parts.libraryCommands?.[command];
        if (handler === undefined) throw failure('io', `The fake knows no command ${command}.`);
        return handler(args);
      }
    }
  }

  const invoke: TauriInvoke = async (command, args, options) => {
    calls.push({ command, args, headers: options?.headers });
    return run(command, args, options);
  };
  return { invoke, calls };
}
