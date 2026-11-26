import { describe, expect, it } from 'vitest';
import { findKnownModel } from '../../src/generation/catalog/knownModels';
import type { ProviderModelRecord } from '../../src/generation/catalog/modelTypes';
import { createGenerateStore, type ReferenceImage } from '../../src/generation/generateStore';

const SUNBURST = findKnownModel('openai', 'gpt-image-2.5-sunburst') as ProviderModelRecord;
const blob = (text: string, type = 'image/jpeg'): Blob => new Blob([text], { type });
const image = (id: string, text = 'uploaded'): ReferenceImage => ({ id, name: `${id}.jpg`, width: 800, height: 600, blob: blob(text) });

function setup() {
  const store = createGenerateStore();
  store.getState().setMaxTextureSize(8192);
  store.getState().setCatalog({ gemini: [], openai: [SUNBURST], openrouter: [] });
  store.getState().addReferences([image('a'), image('b', 'second'), image('c', 'third')]);
  return store;
}
const byId = (store: ReturnType<typeof setup>, id: string) => store.getState().references.find((reference) => reference.id === id)!;

describe('generateStore reference edits (reference-editor R3, R18)', () => {
  it('R3 a new reference is pristine', () => {
    expect(byId(setup(), 'a').original).toBeUndefined();
  });

  it('R18 the first replaceReference keeps the unchanged uploaded blob as the original and swaps the picture in place', () => {
    const store = setup();
    const uploaded = byId(store, 'a').blob;
    const edited = blob('edited', 'image/png');
    store.getState().replaceReference('a', { blob: edited, width: 400, height: 300 });
    const after = byId(store, 'a');
    expect(after.blob).toBe(edited);
    expect([after.width, after.height]).toEqual([400, 300]);
    expect(after.name).toBe('a.jpg');
    expect(after.original).toEqual({ blob: uploaded, mime: 'image/jpeg', width: 800, height: 600 });
    expect(after.original!.blob).toBe(uploaded); // the same object: no re-encoding
  });

  it('R3 a later replace keeps the first original', () => {
    const store = setup();
    const uploaded = byId(store, 'a').blob;
    store.getState().replaceReference('a', { blob: blob('one', 'image/png'), width: 400, height: 300 });
    store.getState().replaceReference('a', { blob: blob('two', 'image/png'), width: 200, height: 100 });
    expect(byId(store, 'a').original!.blob).toBe(uploaded);
    expect(byId(store, 'a').original).toMatchObject({ width: 800, height: 600 });
  });

  it('R18 replace keeps the position and ids of every reference', () => {
    const store = setup();
    store.getState().replaceReference('b', { blob: blob('x', 'image/png'), width: 10, height: 10 });
    expect(store.getState().references.map((reference) => reference.id)).toEqual(['a', 'b', 'c']);
  });

  it('R18 replace of an unknown id changes nothing', () => {
    const store = setup();
    const before = store.getState().references;
    store.getState().replaceReference('nope', { blob: blob('x'), width: 1, height: 1 });
    expect(store.getState().references).toBe(before);
  });

  it('R2 restoreReference brings back the original blob and size and drops the original', () => {
    const store = setup();
    const uploaded = byId(store, 'a').blob;
    store.getState().replaceReference('a', { blob: blob('edited', 'image/png'), width: 400, height: 300 });
    store.getState().restoreReference('a');
    const after = byId(store, 'a');
    expect(after.blob).toBe(uploaded);
    expect([after.width, after.height]).toEqual([800, 600]);
    expect(after.original).toBeUndefined();
    expect(store.getState().references.map((reference) => reference.id)).toEqual(['a', 'b', 'c']);
  });

  it('R18 restore on a pristine or unknown reference changes nothing', () => {
    const store = setup();
    const before = store.getState().references;
    store.getState().restoreReference('a');
    store.getState().restoreReference('nope');
    expect(store.getState().references).toBe(before);
  });

  it('R3 removing a reference removes its original with it', () => {
    const store = setup();
    store.getState().replaceReference('a', { blob: blob('edited', 'image/png'), width: 4, height: 3 });
    store.getState().removeReference('a');
    expect(store.getState().references.map((reference) => reference.id)).toEqual(['b', 'c']);
  });
});
