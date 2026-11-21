// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MasksPackageDialog } from '@shared/materialMasks/ui/MasksPackageDialog';

afterEach(cleanup);

const handlers = () => ({ onDownload: vi.fn(), onCancel: vi.fn(), onCancelDownload: vi.fn(), onContinue: vi.fn() });
const none = { loaded: 0, total: 44568389 };

describe('MasksPackageDialog (masks-package R7-R9)', () => {
  it('TestR7_the_question_names_the_size_the_two_sources_and_the_consequence_of_cancelling', async () => {
    const on = handlers();
    render(<MasksPackageDialog phase="asking" progress={none} {...on} />);
    expect(screen.getByRole('dialog', { name: 'Download the masks package?' })).toBeTruthy();
    const text = screen.getByRole('dialog').textContent ?? '';
    expect(text).toContain('44.6 MB');
    expect(text).toContain('Hugging Face');
    expect(text).toContain('jsDelivr');
    expect(text).toContain("If you cancel, the run goes on and each mask's metal and roughness values are chosen by keyword matching, which is less accurate.");
    await userEvent.setup().click(screen.getByRole('button', { name: 'Download' }));
    expect(on.onDownload).toHaveBeenCalledTimes(1);
  });

  it('TestR7_Escape_and_the_Cancel_button_both_cancel', async () => {
    const on = handlers();
    const user = userEvent.setup();
    render(<MasksPackageDialog phase="asking" progress={none} {...on} />);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(on.onCancel).toHaveBeenCalledTimes(2);
  });

  it('TestR8_while_downloading_it_shows_the_bytes_so_far_and_a_Cancel_that_stops_the_download', async () => {
    const on = handlers();
    render(<MasksPackageDialog phase="downloading" progress={{ loaded: 20000000, total: 44568389 }} {...on} />);
    expect(screen.getByRole('status').textContent).toContain('20.0 of 44.6 MB');
    expect(screen.getByRole('progressbar')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }));
    expect(on.onCancelDownload).toHaveBeenCalledTimes(1);
    expect(on.onCancel).not.toHaveBeenCalled();
  });

  it('TestR9_a_failure_shows_one_line_and_Continue_as_its_only_button', async () => {
    const on = handlers();
    render(<MasksPackageDialog phase="failed" progress={none} {...on} />);
    expect(screen.getByRole('dialog').textContent).toContain('The masks package could not be downloaded. Masks will use keyword matching.');
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Continue']);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continue' }));
    expect(on.onContinue).toHaveBeenCalledTimes(1);
  });

  it('TestR7_nothing_is_shown_with_no_phase', () => {
    render(<MasksPackageDialog phase={null} progress={none} {...handlers()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
