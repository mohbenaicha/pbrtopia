// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReferenceEdit, ReferenceImage } from '../../../src/generation/generateStore';
import { ReferenceStrip } from '../../../src/generation/ui/ReferenceStrip';

interface DialogProps { name: string; width: number; height: number; onApply: (edit: ReferenceEdit) => void; onClose: () => void }
const dialogProps: { current: DialogProps | null } = { current: null };
vi.mock('../../../src/referenceEditor', () => ({
  ReferenceEditorDialog: (props: DialogProps) => { dialogProps.current = props; return <div role="dialog" aria-label={`Edit ${props.name}`} />; },
}));

const pristine = (id: string): ReferenceImage => ({ id, name: `${id}.png`, width: 64, height: 32, blob: new Blob(['x'], { type: 'image/png' }) });
const edited = (id: string): ReferenceImage => ({ ...pristine(id), original: { blob: new Blob(['o'], { type: 'image/jpeg' }), mime: 'image/jpeg', width: 100, height: 50 } });

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
  dialogProps.current = null;
});
afterEach(cleanup);

function setup(references: ReferenceImage[], withEditing = true) {
  const props = { onFiles: vi.fn(), onRemove: vi.fn(), onEdit: vi.fn<(id: string, edit: ReferenceEdit) => void>(), onRestore: vi.fn<(id: string) => void>() };
  render(<ReferenceStrip references={references} notice={null} onFiles={props.onFiles} onRemove={props.onRemove} {...(withEditing ? { onEdit: props.onEdit, onRestore: props.onRestore } : {})} />);
  return props;
}

describe('ReferenceStrip editing (reference-editor R1, R2, R15)', () => {
  it('R1 every thumbnail has a pencil button named after the reference', () => {
    setup([pristine('a'), pristine('b')]);
    expect(screen.getByRole('button', { name: 'Edit a.png' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit b.png' })).toBeTruthy();
  });

  it('R1 the pencil opens the editor on that reference and does nothing else', () => {
    const { onEdit, onRemove, onRestore } = setup([pristine('a'), pristine('b')]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit b.png' }));
    expect(screen.getByRole('dialog', { name: 'Edit b.png' })).toBeTruthy();
    expect(dialogProps.current).toMatchObject({ width: 64, height: 32 });
    expect(onEdit).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('R1 a strip without edit handlers (the material generator) shows no pencil', () => {
    setup([pristine('a')], false);
    expect(screen.queryByRole('button', { name: 'Edit a.png' })).toBeNull();
  });

  it('R2 only an edited reference has a restore button', () => {
    setup([pristine('a'), edited('b')]);
    expect(screen.queryByRole('button', { name: 'Restore original a.png' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Restore original b.png' })).toBeTruthy();
  });

  it('R2 restore names the reference and opens nothing', () => {
    const { onRestore } = setup([edited('b')]);
    fireEvent.click(screen.getByRole('button', { name: 'Restore original b.png' }));
    expect(onRestore).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('R15 Apply hands the edit of that reference up and closes the editor', () => {
    const { onEdit } = setup([pristine('a')]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit a.png' }));
    const edit = { blob: new Blob(['e']), width: 10, height: 20 };
    dialogProps.current!.onApply(edit);
    expect(onEdit).toHaveBeenCalledWith('a', edit);
  });

  it('R15 closing the editor without applying changes nothing', () => {
    const { onEdit } = setup([pristine('a')]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit a.png' }));
    dialogProps.current!.onClose();
    expect(onEdit).not.toHaveBeenCalled();
  });
});
