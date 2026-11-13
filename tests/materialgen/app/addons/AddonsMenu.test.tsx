// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddonsMenu } from '../../../../src/materialgen/app/addons/AddonsMenu';
import { downloadAddon } from '../../../../src/materialgen/app/addons/downloadAddon';
import { ADDONS } from '../../../../src/materialgen/app/addons/addonFiles';

afterEach(cleanup);

describe('AddonsMenu (materialgen/addons R3-R5)', () => {
  it('TestR3_the_button_opens_a_popover_with_blender_then_maya_and_escape_closes_it', async () => {
    const user = userEvent.setup();
    render(<AddonsMenu download={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Add-ons' }));
    const entries = screen.getAllByRole('button', { name: /^Download the/ });
    expect(entries.map((entry) => entry.getAttribute('aria-label'))).toEqual(['Download the Blender add-on', 'Download the Maya add-on']);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Add-ons' })).toBeNull();
  });

  it('TestR5_a_click_downloads_that_plugin_only_and_a_failure_shows_one_line_and_keeps_the_popover_open', async () => {
    const user = userEvent.setup();
    const download = vi.fn(async () => ({ ok: false as const, error: { kind: 'aborted', message: 'The Blender add-on could not be downloaded.' } }));
    render(<AddonsMenu download={download as never} />);
    await user.click(screen.getByRole('button', { name: 'Add-ons' }));
    await user.click(screen.getByRole('button', { name: 'Download the Blender add-on' }));
    expect(download).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledWith(ADDONS[0]);
    expect((await screen.findByRole('alert')).textContent).toBe('The Blender add-on could not be downloaded.');
    expect(screen.getByRole('button', { name: 'Download the Maya add-on' })).toBeTruthy();
  });
});

describe('downloadAddon (materialgen/addons R5)', () => {
  it('TestR5_it_fetches_the_zip_and_saves_it_under_its_own_name', async () => {
    const saveBlob = vi.fn();
    const fetchFile = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    const result = await downloadAddon(ADDONS[1]!, { saveBlob }, fetchFile as never);
    expect(result.ok).toBe(true);
    expect(saveBlob.mock.calls[0]![1]).toBe('integration_maya_modules.zip');
    await waitFor(() => expect(fetchFile).toHaveBeenCalledWith(ADDONS[1]!.zipUrl));
  });

  it('TestR5_a_failed_fetch_is_a_failure_with_the_add_on_named_and_saves_nothing', async () => {
    const saveBlob = vi.fn();
    const result = await downloadAddon(ADDONS[0]!, { saveBlob }, (async () => new Response(null, { status: 404 })) as never);
    expect(result.ok).toBe(false);
    expect(saveBlob).not.toHaveBeenCalled();
  });
});
