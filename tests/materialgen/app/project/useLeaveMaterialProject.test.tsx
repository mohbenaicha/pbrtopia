// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canLeaveRoute } from '../../../../src/shell/routing/routeGuard';
import { useLeaveMaterialProject } from '../../../../src/materialgen/app/project/useLeaveMaterialProject';

beforeEach(() => {
  window.location.hash = '#/p/a';
});
afterEach(cleanup);

const harness = () => {
  const calls: string[] = [];
  const store = { saveAppSettings: vi.fn(async () => ({ ok: true as const, value: undefined })) };
  const flush = vi.fn(async () => void calls.push('flush'));
  const saveThumbnail = vi.fn(async () => void calls.push('thumbnail'));
  const hook = renderHook(() => useLeaveMaterialProject({ store, flush, saveThumbnail }));
  return { calls, store, flush, saveThumbnail, hook };
};

describe('materialgen/app R12 materialgen/preview R54 leaving the project', () => {
  it('R54 the Projects button saves the thumbnail, then the waiting save, then shows the list', async () => {
    const { calls, hook, store } = harness();
    await act(() => hook.result.current.showProjectList());
    expect(calls).toEqual(['thumbnail', 'flush']);
    expect(store.saveAppSettings).toHaveBeenCalledWith({ lastOpenProjectId: null });
    expect(window.location.hash).toBe('#/projects');
  });

  it('R54 Settings saves the thumbnail too and keeps the project as the remembered one', async () => {
    const { calls, hook, store } = harness();
    await act(() => hook.result.current.showSettings());
    expect(calls).toEqual(['thumbnail', 'flush']);
    expect(store.saveAppSettings).not.toHaveBeenCalled();
  });

  it('R54 Back, Forward or a typed address leave through the same two steps', async () => {
    const { calls } = harness();
    await act(async () => void (await canLeaveRoute()));
    expect(calls).toEqual(['thumbnail', 'flush']);
  });
});
