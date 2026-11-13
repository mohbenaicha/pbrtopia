import { BridgeError } from '../bridgeError';
import type { RecordEntry, RecordOp } from '../RecordBridge';

// Storage-backends data-model "Commit wire format": [u32 little-endian header length][JSON header][payloads one after another].
// Record bytes never travel as JSON numbers or base64 (R8).

function frame(header: unknown, payloads: Uint8Array[]): Uint8Array {
  const head = new TextEncoder().encode(JSON.stringify(header));
  const out = new Uint8Array(4 + head.length + payloads.reduce((total, payload) => total + payload.length, 0));
  new DataView(out.buffer).setUint32(0, head.length, true);
  out.set(head, 4);
  let at = 4 + head.length;
  for (const payload of payloads) {
    out.set(payload, at);
    at += payload.length;
  }
  return out;
}

/** The raw body of a commit: one header item per op, then the bytes of each `put` in the same order. */
export function encodeCommitBody(ops: RecordOp[]): Uint8Array {
  const payloads: Uint8Array[] = [];
  const header = ops.map((op) => {
    if (op.op === 'remove') return { op: 'remove', collection: op.collection, key: op.key };
    if (op.op === 'removeByParent') return { op: 'removeByParent', collection: op.collection, parent: op.parent };
    payloads.push(op.value);
    return {
      op: 'put',
      collection: op.collection,
      key: op.key,
      ...(op.parent === undefined ? {} : { parent: op.parent }),
      ...(op.sort === undefined ? {} : { sort: op.sort }),
      length: op.value.length,
    };
  });
  return frame(header, payloads);
}

/** An answer from a raw-response command, whatever shape the bridge hands it back in. */
function bytesOf(answer: unknown): Uint8Array {
  if (answer instanceof Uint8Array) return answer;
  if (answer instanceof ArrayBuffer) return new Uint8Array(answer);
  if (Array.isArray(answer)) return Uint8Array.from(answer as number[]);
  throw new BridgeError('io', 'The desktop app sent an answer the page cannot read.');
}

const cutShort = (): BridgeError => new BridgeError('io', 'The desktop app sent an answer that was cut short.');

interface ListedItem {
  key?: unknown;
  parent?: unknown;
  sort?: unknown;
  length?: unknown;
}

/** A listing: the header names each entry's key, indexed keys and byte length; the values follow in order. A listing that does not add up is refused. */
export function decodeEntries(answer: unknown): RecordEntry[] {
  const body = bytesOf(answer);
  if (body.length < 4) throw cutShort();
  const headerLength = new DataView(body.buffer, body.byteOffset, body.byteLength).getUint32(0, true);
  if (4 + headerLength > body.length) throw cutShort();
  let items: ListedItem[];
  try {
    items = JSON.parse(new TextDecoder().decode(body.subarray(4, 4 + headerLength))) as ListedItem[];
  } catch {
    throw cutShort();
  }
  let at = 4 + headerLength;
  const entries: RecordEntry[] = items.map((item) => {
    if (typeof item.key !== 'string' || typeof item.length !== 'number' || at + item.length > body.length) throw cutShort();
    const value = body.slice(at, at + item.length);
    at += item.length;
    return {
      key: item.key,
      ...(typeof item.parent === 'string' ? { parent: item.parent } : {}),
      ...(typeof item.sort === 'string' ? { sort: item.sort } : {}),
      value,
    };
  });
  if (at !== body.length) throw cutShort();
  return entries;
}

/** `[0]` is "no such thing"; `[1, ...bytes]` is a thing with those bytes (possibly none). */
export function decodeOptionalBytes(answer: unknown): Uint8Array | null {
  const body = bytesOf(answer);
  if (body.length === 0) throw cutShort();
  return body[0] === 0 ? null : body.slice(1);
}
