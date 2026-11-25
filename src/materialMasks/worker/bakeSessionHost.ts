import type { BakeRow } from '../bake/bakeMasks';
import type { MapName } from '../bake/diffBakedRows';
import type { MapResult } from '../bake/mapResult';
import { BakeSessionState, type SessionStart } from './bakeSessionState';

/** Mask-bake-session R5, R6: the messages between the page and its bake session worker. Buffers in `start`, `setGrey` and `baked` are moved, not copied. */
export type SessionRequest =
  | ({ kind: 'start' } & SessionStart)
  | { kind: 'setGrey'; grey: Uint8Array | null }
  | { kind: 'edit'; editId: number; rows: BakeRow[]; feather: number; maps: MapName[]; changedLabels: number[] | 'all' }
  | { kind: 'end' };

export type SessionReply =
  | { kind: 'baked'; editId: number; maps: Partial<Record<MapName, MapResult>> }
  | { kind: 'failed'; editId?: number; message: string };

/**
 * Mask-bake-session R5, R6, R12: what the worker does with each message, apart from the Worker scope itself, so the same code runs in the worker and in tests. A message handled
 * in order; an edit that fails answers `failed` and drops the session (the page then bakes with the one-shot job and starts a new session at the next edit).
 */
export function createSessionHost(post: (reply: SessionReply, transfer: ArrayBuffer[]) => void): { handle(request: SessionRequest): void } {
  let state: BakeSessionState | null = null;
  return {
    handle(request) {
      try {
        if (request.kind === 'start') {
          const { size, labels, maps, coverage, grey } = request;
          state = new BakeSessionState({ size, labels, maps, ...(coverage === undefined ? {} : { coverage }), ...(grey === undefined ? {} : { grey }) });
        } else if (request.kind === 'setGrey') {
          state?.setGrey(request.grey);
        } else if (request.kind === 'end') {
          state = null;
        } else {
          if (state === null) throw new Error('No bake session.');
          const maps = state.edit(request);
          post({ kind: 'baked', editId: request.editId, maps }, Object.values(maps).flatMap((result) => (result.kind === 'whole' ? [result.bytes.buffer as ArrayBuffer] : result.rects.map((rect) => rect.bytes.buffer as ArrayBuffer))));
        }
      } catch (error) {
        const failed: SessionReply = { kind: 'failed', message: error instanceof Error ? error.message : 'The bake session failed.', ...(request.kind === 'edit' ? { editId: request.editId } : {}) };
        state = null;
        post(failed, []);
      }
    },
  };
}
