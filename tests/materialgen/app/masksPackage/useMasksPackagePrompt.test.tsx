// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMasksPackagePrompt, type MasksPackagePrompt } from '../../../../src/materialgen/app/masksPackage/useMasksPackagePrompt';
import { MASKS_PACKAGE_FILES } from '../../../../src/materialgen/masks/package/masksPackageManifest';
import type { PackageCache } from '../../../../src/materialgen/masks/package/masksPackageStore';

afterEach(cleanup);

function cacheWith(installed: boolean): PackageCache {
  const entries = new Map<string, Response>(installed ? MASKS_PACKAGE_FILES.map((file) => [file.url, new Response('x')]) : []);
  return { match: async (url) => entries.get(url)?.clone(), put: async (url, response) => void entries.set(url, response) };
}

function mount(options: { installed?: boolean; download?: ReturnType<typeof vi.fn>; declined?: { value: boolean } } = {}) {
  const declined = options.declined ?? { value: false };
  const download = options.download ?? vi.fn(async () => ({ ok: true as const }));
  const holder: { current: MasksPackagePrompt | null } = { current: null };
  function Harness() {
    holder.current = useMasksPackagePrompt({ openCache: async () => cacheWith(options.installed ?? false), download: download as never, declined });
    return <>{holder.current.dialog}</>;
  }
  render(<Harness />);
  return { holder, download, declined };
}

async function askAndSettle(holder: { current: MasksPackagePrompt | null }): Promise<{ settled: () => boolean }> {
  let done = false;
  void holder.current!.ensure().then(() => { done = true; });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return { settled: () => done };
}

describe('the masks package prompt (masks-package R6, R8-R10)', () => {
  it('TestR6_with_the_package_installed_nothing_is_asked_and_the_run_goes_on_at_once', async () => {
    const { holder, download } = mount({ installed: true });
    const { settled } = await askAndSettle(holder);
    expect(settled()).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(download).not.toHaveBeenCalled();
  });

  it('TestR6_with_no_package_the_dialog_appears_and_the_run_waits_for_the_answer', async () => {
    const { holder } = mount();
    const { settled } = await askAndSettle(holder);
    expect(screen.getByRole('dialog', { name: 'Download the masks package?' })).toBeTruthy();
    expect(settled()).toBe(false);
  });

  it('TestR8_Download_runs_the_download_and_then_the_run_goes_on', async () => {
    const { holder, download } = mount();
    const { settled } = await askAndSettle(holder);
    await act(async () => { await userEvent.setup().click(screen.getByRole('button', { name: 'Download' })); });
    expect(download).toHaveBeenCalledTimes(1);
    expect(settled()).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('TestR10_Cancel_lets_the_run_go_on_and_the_question_is_not_asked_again_until_a_reload', async () => {
    const { holder, declined, download } = mount();
    const first = await askAndSettle(holder);
    await act(async () => { await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' })); });
    expect(first.settled()).toBe(true);
    expect(declined.value).toBe(true);
    const second = await askAndSettle(holder);
    expect(second.settled()).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(download).not.toHaveBeenCalled();
  });

  it('TestR9_a_failed_download_shows_the_line_and_Continue_lets_the_run_go_on_with_nothing_declined', async () => {
    const { holder, declined } = mount({ download: vi.fn(async () => ({ ok: false as const, reason: 'failed' as const })) });
    const { settled } = await askAndSettle(holder);
    await act(async () => { await userEvent.setup().click(screen.getByRole('button', { name: 'Download' })); });
    expect(screen.getByRole('dialog').textContent).toContain('The masks package could not be downloaded. Masks will use keyword matching.');
    expect(settled()).toBe(false);
    await act(async () => { await userEvent.setup().click(screen.getByRole('button', { name: 'Continue' })); });
    expect(settled()).toBe(true);
    expect(declined.value).toBe(false);
  });

  it('TestR9_cancelling_the_download_while_it_runs_aborts_it_and_lets_the_run_go_on_without_a_failure_line', async () => {
    const download = vi.fn((_deps: unknown, options: { signal: AbortSignal }) => new Promise((resolve) => options.signal.addEventListener('abort', () => resolve({ ok: false, reason: 'aborted' }))));
    const { holder } = mount({ download });
    const { settled } = await askAndSettle(holder);
    await act(async () => { await userEvent.setup().click(screen.getByRole('button', { name: 'Download' })); });
    expect(settled()).toBe(false);
    await act(async () => { await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' })); });
    expect(settled()).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('TestR6_where_cache_storage_cannot_open_nothing_is_asked_and_the_run_goes_on', async () => {
    const holder: { current: MasksPackagePrompt | null } = { current: null };
    function Harness() {
      holder.current = useMasksPackagePrompt({ openCache: async () => { throw new Error('no cache storage'); }, download: vi.fn() as never, declined: { value: false } });
      return <>{holder.current.dialog}</>;
    }
    render(<Harness />);
    const { settled } = await askAndSettle(holder);
    expect(settled()).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
