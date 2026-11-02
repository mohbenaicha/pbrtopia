import { describe, expect, it } from 'vitest';
import { createRunLogStore } from '../../src/generation/runLogStore';

const init = (projectId = 'p1', prompt = 'a red barn') => ({ projectId, modelLabel: 'Gemini 3 Pro Image', prompt, startedAt: 1000 });
const blob = (text: string): Blob => new Blob([text]);

describe('runLogStore', () => {
  it('R25 begin makes a running row, newest first, and marks it as the active run', () => {
    const store = createRunLogStore();
    const first = store.getState().begin(init());
    const second = store.getState().begin(init('p1', 'second'));
    const { records, activeId } = store.getState();
    expect(records.map((record) => record.id)).toEqual([second, first]);
    expect(records[0]).toMatchObject({ projectId: 'p1', prompt: 'second', outcome: 'running', atlas: null, enhancedPrompt: null, imagePreview: null, errorMessage: null, errorDetails: null, modelLabel: 'Gemini 3 Pro Image', startedAt: 1000 });
    expect(activeId).toBe(second);
  });

  it('R25 the atlas, the enhanced prompt and the image preview are added to the row as the run produces them', () => {
    const store = createRunLogStore();
    const id = store.getState().begin(init());
    const atlas = blob('atlas');
    const preview = blob('image');
    store.getState().setAtlas(id, atlas);
    store.getState().setEnhancedPrompt(id, 'A weathered red barn.');
    store.getState().setImage(id, preview);
    expect(store.getState().records[0]).toMatchObject({ atlas, enhancedPrompt: 'A weathered red barn.', imagePreview: preview, outcome: 'running' });
  });

  it('R25 finish ends the row as done, failed with its message, or cancelled', () => {
    const store = createRunLogStore();
    const done = store.getState().begin(init());
    const failed = store.getState().begin(init());
    const cancelled = store.getState().begin(init());
    store.getState().finish(done, 'done');
    store.getState().finish(failed, 'failed', { message: 'The image model refused the request.', details: 'content policy' });
    store.getState().finish(cancelled, 'cancelled');
    const byId = Object.fromEntries(store.getState().records.map((record) => [record.id, record]));
    expect(byId[done]).toMatchObject({ outcome: 'done', errorMessage: null, errorDetails: null });
    expect(byId[failed]).toMatchObject({ outcome: 'failed', errorMessage: 'The image model refused the request.', errorDetails: 'content policy' });
    expect(byId[cancelled]).toMatchObject({ outcome: 'cancelled', errorMessage: null, errorDetails: null });
  });

  it('R25 a failure with no provider details has no details', () => {
    const store = createRunLogStore();
    const id = store.getState().begin(init());
    store.getState().finish(id, 'failed', { message: 'Validation failed.' });
    expect(store.getState().records[0]).toMatchObject({ errorMessage: 'Validation failed.', errorDetails: null });
  });

  it('R25 resume continues the same row: running again, the error and the image cleared, the other parts kept, and it is the active run again', () => {
    const store = createRunLogStore();
    const id = store.getState().begin(init());
    const other = store.getState().begin(init());
    const atlas = blob('atlas');
    store.getState().setAtlas(id, atlas);
    store.getState().setEnhancedPrompt(id, 'kept');
    store.getState().setImage(id, blob('old image'));
    store.getState().finish(id, 'failed', { message: 'boom', details: 'more' });
    expect(store.getState().resume(id)).toBe(true);
    expect(store.getState().records.find((record) => record.id === id)).toMatchObject({ outcome: 'running', errorMessage: null, errorDetails: null, imagePreview: null, enhancedPrompt: 'kept', atlas });
    expect(store.getState().activeId).toBe(id);
    expect(store.getState().records.map((record) => record.id)).toEqual([other, id]);
  });

  it('R25 resume of a row that is gone says so and changes nothing', () => {
    const store = createRunLogStore();
    const id = store.getState().begin(init());
    store.getState().finish(id, 'failed', { message: 'x' });
    store.getState().remove(id);
    const before = store.getState();
    expect(store.getState().resume(id)).toBe(false);
    expect(store.getState()).toBe(before);
  });

  it('R26 remove deletes that row only', () => {
    const store = createRunLogStore();
    const first = store.getState().begin(init());
    const second = store.getState().begin(init());
    store.getState().finish(first, 'done');
    store.getState().finish(second, 'done');
    store.getState().remove(first);
    expect(store.getState().records.map((record) => record.id)).toEqual([second]);
  });

  it('R26 remove is ignored while the row runs', () => {
    const store = createRunLogStore();
    const id = store.getState().begin(init());
    store.getState().remove(id);
    expect(store.getState().records).toHaveLength(1);
  });

  it('R26 keeps at most 10 rows: the 11th run drops the oldest row that is not running', () => {
    const store = createRunLogStore();
    const ids: string[] = [];
    for (let index = 0; index < 10; index += 1) {
      const id = store.getState().begin(init('p1', `run ${index}`));
      ids.push(id);
      store.getState().finish(id, 'done');
    }
    const eleventh = store.getState().begin(init('p1', 'run 10'));
    const kept = store.getState().records.map((record) => record.id);
    expect(kept).toHaveLength(10);
    expect(kept[0]).toBe(eleventh);
    expect(kept).not.toContain(ids[0]);
    expect(kept).toContain(ids[1]);
  });

  it('R26 never drops a running row to make room', () => {
    const store = createRunLogStore();
    const runningOldest = store.getState().begin(init('p1', 'still going'));
    for (let index = 0; index < 9; index += 1) store.getState().finish(store.getState().begin(init()), 'done');
    store.getState().begin(init('p1', 'eleventh'));
    const kept = store.getState().records.map((record) => record.id);
    expect(kept).toContain(runningOldest);
    expect(kept).toHaveLength(10);
  });

  it('R26 when more than 10 rows run at once and one ends, the oldest row that is not running goes then', () => {
    const store = createRunLogStore();
    const running = Array.from({ length: 11 }, (_, index) => store.getState().begin(init('p1', `run ${index}`)));
    expect(store.getState().records).toHaveLength(11); // none is idle, so none can be dropped
    store.getState().finish(running[3]!, 'done');
    expect(store.getState().records).toHaveLength(11); // the row that just ended is never the one to go
    store.getState().finish(running[5]!, 'failed', { message: 'x' });
    const kept = store.getState().records.map((record) => record.id);
    expect(kept).toHaveLength(10); // now the older idle row makes room
    expect(kept).not.toContain(running[3]!);
    expect(kept).toContain(running[5]!);
  });

  it('R26 rows keep the project they ran in', () => {
    const store = createRunLogStore();
    store.getState().begin(init('a'));
    store.getState().begin(init('b'));
    expect(store.getState().records.map((record) => record.projectId)).toEqual(['b', 'a']);
  });

  it('custom R27 a new row has no sheet pictures; setSheetPicture adds the snapshot and the image of a sheet in sheet order', () => {
    const store = createRunLogStore();
    const id = store.getState().begin(init());
    expect(store.getState().records[0]?.sheets).toEqual([]);
    const snapshot = blob('snap-1');
    const image = blob('img-1');
    store.getState().setSheetPicture(id, { index: 1, label: 'Left, Right' }, 'snapshot', snapshot);
    store.getState().setSheetPicture(id, { index: 0, label: 'Front' }, 'snapshot', blob('snap-0'));
    store.getState().setSheetPicture(id, { index: 1, label: 'Left, Right' }, 'image', image);
    const sheets = store.getState().records[0]?.sheets;
    expect(sheets?.map((sheet) => sheet.index)).toEqual([0, 1]);
    expect(sheets?.[1]).toEqual({ index: 1, label: 'Left, Right', snapshot, image });
    expect(sheets?.[0]).toMatchObject({ label: 'Front', image: null });
  });

  it('custom R27 a second picture of the same kind replaces the first', () => {
    const store = createRunLogStore();
    const id = store.getState().begin(init());
    const sheet = { index: 0, label: 'Front' };
    store.getState().setSheetPicture(id, sheet, 'image', blob('old'));
    const fresh = blob('new');
    store.getState().setSheetPicture(id, sheet, 'image', fresh);
    expect(store.getState().records[0]?.sheets).toHaveLength(1);
    expect(store.getState().records[0]?.sheets[0]?.image).toBe(fresh);
  });

  it('custom R18 resuming a row keeps the sheet pictures already there', () => {
    const store = createRunLogStore();
    const id = store.getState().begin(init());
    const image = blob('kept');
    store.getState().setSheetPicture(id, { index: 0, label: 'Front' }, 'image', image);
    store.getState().finish(id, 'failed', { message: 'x' });
    store.getState().resume(id);
    expect(store.getState().records[0]?.sheets[0]?.image).toBe(image);
  });

  it('R25 an action given an unknown id changes nothing', () => {
    const store = createRunLogStore();
    store.getState().begin(init());
    const before = store.getState().records;
    store.getState().setAtlas('missing', blob('x'));
    store.getState().setEnhancedPrompt('missing', 'x');
    store.getState().setImage('missing', blob('x'));
    store.getState().setSheetPicture('missing', { index: 0, label: 'Front' }, 'image', blob('x'));
    store.getState().finish('missing', 'failed', { message: 'x' });
    store.getState().resume('missing');
    store.getState().remove('missing');
    expect(store.getState().records).toBe(before);
  });
});
