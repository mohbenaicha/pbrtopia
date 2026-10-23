// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResetSavedKeys } from '../../../src/keys/ui/ResetSavedKeys';
import type { DeleteSavedKeys } from '../../../src/keys/ui/useDeleteSavedKeys';

afterEach(cleanup);

function setup(problem: string | null, deletion: Partial<DeleteSavedKeys> = {}) {
  const full: DeleteSavedKeys = { deleting: false, failure: null, deleteSavedKeys: vi.fn(async () => true), clearFailure: vi.fn(), ...deletion };
  const view = render(<ResetSavedKeys problem={problem} deletion={full} />);
  return { deletion: full, ...view };
}

describe('ResetSavedKeys (R6)', () => {
  it('R6 with no problem it shows no message and no Reset button', () => {
    setup(null);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset saved keys' })).toBeNull();
  });

  it('R6 a vault that cannot be read is reported with a Reset saved keys button that deletes nothing by itself', () => {
    const { deletion } = setup('The saved keys cannot be read.');
    expect(screen.getByRole('alert').textContent).toBe('The saved keys cannot be read.');
    fireEvent.click(screen.getByRole('button', { name: 'Reset saved keys' }));
    expect(screen.getByRole('dialog', { name: 'Reset saved keys?' })).toBeTruthy();
    expect(deletion.deleteSavedKeys).not.toHaveBeenCalled();
  });

  it('R6 Cancel closes the confirmation and clears an earlier failure', () => {
    const { deletion } = setup('Unreadable.');
    fireEvent.click(screen.getByRole('button', { name: 'Reset saved keys' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(deletion.clearFailure).toHaveBeenCalledTimes(1);
    expect(deletion.deleteSavedKeys).not.toHaveBeenCalled();
  });

  it('R6 confirming deletes, and the confirmation closes once the keys are gone', async () => {
    const { deletion } = setup('Unreadable.');
    fireEvent.click(screen.getByRole('button', { name: 'Reset saved keys' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete saved keys' }));
    expect(deletion.deleteSavedKeys).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(deletion.clearFailure).toHaveBeenCalled();
  });

  it('R6 a delete that fails keeps the confirmation open, with the failure shown, so it can be tried again', async () => {
    const deleteSavedKeys = vi.fn(async () => false);
    setup('Unreadable.', { deleteSavedKeys, failure: 'Could not delete.' });
    fireEvent.click(screen.getByRole('button', { name: 'Reset saved keys' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete saved keys' }));
    await waitFor(() => expect(deleteSavedKeys).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('dialog', { name: 'Reset saved keys?' }).textContent).toContain('Could not delete.');
  });

  it('R6 once the vault reads again (problem null) a confirmation that is open stays until the delete ends', () => {
    const { rerender, deletion } = setup('Unreadable.', { deleting: true });
    fireEvent.click(screen.getByRole('button', { name: 'Reset saved keys' }));
    rerender(<ResetSavedKeys problem={null} deletion={deletion} />);
    expect(screen.getByRole('dialog', { name: 'Reset saved keys?' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reset saved keys' })).toBeNull();
  });
});
