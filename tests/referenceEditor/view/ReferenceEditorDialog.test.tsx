// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeToRaster } from '../../../src/referenceEditor/io/decodeToRaster';
import { ReferenceEditorDialog } from '../../../src/referenceEditor/view/ReferenceEditorDialog';

vi.mock('../../../src/referenceEditor/io/decodeToRaster', () => ({ decodeToRaster: vi.fn(() => new Promise(() => undefined)) }));

afterEach(cleanup);

const open = () => {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(<ReferenceEditorDialog source={new Blob(['x'])} width={8} height={8} name="a.png" onApply={onApply} onClose={onClose} />);
  return { onApply, onClose };
};

describe('ReferenceEditorDialog (reference-editor R4, R15, R20)', () => {
  it('R4 opens a modal dialog labelled Edit <name> with a spinner while the picture decodes', () => {
    open();
    expect(screen.getByRole('dialog', { name: 'Edit a.png' })).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(vi.mocked(decodeToRaster)).toHaveBeenCalledTimes(1);
  });

  it('R15 Apply is not available while the picture is still loading, Cancel is', () => {
    open();
    expect((screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('R15 Cancel closes the editor and applies nothing', async () => {
    const { onApply, onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onApply).not.toHaveBeenCalled();
  });

  it('R20 Esc does not dismiss the dialog (the editor owns it)', () => {
    const { onClose } = open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Edit a.png' })).toBeTruthy();
  });
});
