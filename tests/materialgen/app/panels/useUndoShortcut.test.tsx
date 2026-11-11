// @vitest-environment jsdom
import { cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { editMaps, placeMap, type MapsState } from '@mat/maps';
import { useUndoShortcut } from '@mat/app/panels/useUndoShortcut';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const record = (key: string) => ({ originalKey: key, workingKey: key, width: 256, height: 256 });
const base = (): MapsState => placeMap(placeMap({ size: 256, maps: {} }, 'albedo', record('a')), 'normal', record('n'));
const edited = (): MapsState => editMaps(base(), [{ kind: 'normal', workingKey: 'n2' }], 'Filter');

function setup(initial: MapsState, options: { canWrite?: boolean; busy?: boolean } = {}) {
  const undo = vi.fn();
  const hook = renderHook((props: { state: MapsState }) => useUndoShortcut({ state: props.state, colorMode: 'albedo', canWrite: options.canWrite ?? true, busy: options.busy ?? false, undo }), { initialProps: { state: initial } });
  return { undo, hook };
}
const press = (init: KeyboardEventInit = {}, target: Element | Document = document): boolean => fireEvent.keyDown(target, { key: 'z', ctrlKey: true, ...init });

describe('materialgen/app R47 useUndoShortcut', () => {
  it('R47 Ctrl+Z undoes the card last edited in this session', () => {
    const { undo, hook } = setup(base());
    hook.rerender({ state: edited() });
    expect(press()).toBe(false); // the browser's own undo is stopped
    expect(undo).toHaveBeenCalledWith(['normal']);
  });

  it('R47 Cmd+Z does the same', () => {
    const { undo, hook } = setup(base());
    hook.rerender({ state: edited() });
    press({ ctrlKey: false, metaKey: true });
    expect(undo).toHaveBeenCalledOnce();
  });

  it('R47 with no edit made in this session nothing is undone, even if a map carries an old undo entry', () => {
    const { undo } = setup(edited());
    press();
    expect(undo).not.toHaveBeenCalled();
  });

  it('R47 it does nothing once the last edited card has no undo entry left', () => {
    const { undo, hook } = setup(base());
    hook.rerender({ state: edited() });
    hook.rerender({ state: base() }); // undone
    press();
    expect(undo).not.toHaveBeenCalled();
  });

  it('R47 it does nothing while a text field has focus', () => {
    const { undo, hook } = setup(base());
    hook.rerender({ state: edited() });
    const field = document.body.appendChild(document.createElement('textarea'));
    press({}, field);
    expect(undo).not.toHaveBeenCalled();
  });

  it('R47 a focused slider, checkbox or select is not a text field: Ctrl+Z still undoes', () => {
    const { undo, hook } = setup(base());
    hook.rerender({ state: edited() });
    for (const make of [() => Object.assign(document.createElement('input'), { type: 'range' }), () => Object.assign(document.createElement('input'), { type: 'checkbox' }), () => document.createElement('select')]) {
      const control = document.body.appendChild(make());
      press({}, control);
    }
    expect(undo).toHaveBeenCalledTimes(3);
  });

  it('R47 a text input and a contenteditable element both count as text fields', () => {
    const { undo, hook } = setup(base());
    hook.rerender({ state: edited() });
    const text = document.body.appendChild(Object.assign(document.createElement('input'), { type: 'text' }));
    const editable = document.body.appendChild(document.createElement('div'));
    editable.setAttribute('contenteditable', 'true');
    press({}, text);
    press({}, editable);
    expect(undo).not.toHaveBeenCalled();
  });

  it('R47 a held key does not repeat the undo', () => {
    const { undo, hook } = setup(base());
    hook.rerender({ state: edited() });
    press({ repeat: true });
    expect(undo).not.toHaveBeenCalled();
  });

  it('R47 with two cards edited, the later one is undone', () => {
    const { undo, hook } = setup(base());
    hook.rerender({ state: editMaps(base(), [{ kind: 'albedo', workingKey: 'a2' }], 'Filter') });
    hook.rerender({ state: editMaps(editMaps(base(), [{ kind: 'albedo', workingKey: 'a2' }], 'Filter'), [{ kind: 'normal', workingKey: 'n2' }], 'Filter') });
    press();
    expect(undo).toHaveBeenCalledWith(['normal']);
  });

  it('R47 it does nothing while a dialog is open or the setup overlay is open', () => {
    const { undo, hook } = setup(base());
    hook.rerender({ state: edited() });
    const dialog = document.body.appendChild(document.createElement('div'));
    dialog.setAttribute('role', 'dialog');
    press();
    dialog.remove();
    document.body.appendChild(document.createElement('div')).className = 'setup-overlay';
    press();
    expect(undo).not.toHaveBeenCalled();
  });

  it('R47 it does nothing in read-only mode, and not while the map is being changed (its button is disabled)', () => {
    const readOnly = setup(base(), { canWrite: false });
    readOnly.hook.rerender({ state: edited() });
    press();
    expect(readOnly.undo).not.toHaveBeenCalled();
    const busy = setup(base(), { busy: true });
    busy.hook.rerender({ state: edited() });
    press();
    expect(busy.undo).not.toHaveBeenCalled();
  });

  it('R47 other keys, and Ctrl+Shift+Z, do nothing', () => {
    const { undo, hook } = setup(base());
    hook.rerender({ state: edited() });
    press({ key: 'y' });
    press({ shiftKey: true });
    fireEvent.keyDown(document, { key: 'z' });
    expect(undo).not.toHaveBeenCalled();
  });
});
