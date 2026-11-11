// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapsState } from '@mat/maps';
import { OpenImageButton } from '../../../../src/materialgen/preview/ui/OpenImageButton';

const record = (workingKey: string) => ({ originalKey: 'o', workingKey, undoKey: null, width: 512, height: 512 });
const state: MapsState = { size: 512, maps: { normal: record('normal-w'), albedo: record('albedo-w') } };
const created: string[] = [];
const revoked: string[] = [];

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => `blob:${created.push('x')}`), revokeObjectURL: vi.fn((url: string) => void revoked.push(url)) }));
});
afterEach(() => {
  cleanup();
  created.length = 0;
  revoked.length = 0;
  vi.unstubAllGlobals();
});

const readBlob = vi.fn(async (key: string) => new Blob([key], { type: 'image/png' }));

describe('materialgen/preview R55 Open image', () => {
  it('R55 it is not offered in the Shaded view', () => {
    render(<OpenImageButton shading="lit" mapsState={state} readBlob={readBlob} />);
    expect(screen.queryByRole('button', { name: 'Open image' })).toBeNull();
  });

  it('R55 it is offered in every flat view', () => {
    for (const shading of ['albedo', 'normal', 'rough', 'metal', 'height', 'ao'] as const) {
      const { unmount } = render(<OpenImageButton shading={shading} mapsState={state} readBlob={readBlob} />);
      expect(screen.getByRole('button', { name: 'Open image' })).toBeTruthy();
      unmount();
    }
  });

  it('R55 a click opens the large viewer on the working copy of that map with its name, size and colour space', async () => {
    render(<OpenImageButton shading="normal" mapsState={state} readBlob={readBlob} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open image' }));
    await waitFor(() => expect(screen.getByRole('img', { name: 'Normal' })).toBeTruthy());
    expect(readBlob).toHaveBeenCalledWith('normal-w');
    expect(screen.getByText('512 x 512')).toBeTruthy();
    expect(screen.getByText('Linear colour space')).toBeTruthy();
  });

  it('R55 the albedo is described as sRGB', async () => {
    render(<OpenImageButton shading="albedo" mapsState={state} readBlob={readBlob} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open image' }));
    await waitFor(() => expect(screen.getByText('sRGB colour space')).toBeTruthy());
  });

  it('R55 R56 closing the viewer removes it and releases the picture', async () => {
    render(<OpenImageButton shading="normal" mapsState={state} readBlob={readBlob} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open image' }));
    await waitFor(() => expect(screen.getByRole('img', { name: 'Normal' })).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('img', { name: 'Normal' })).toBeNull();
    expect(revoked).toHaveLength(1);
  });

  it('R55 a map the project does not have has the button disabled with the reason', () => {
    render(<OpenImageButton shading="height" mapsState={state} readBlob={readBlob} />);
    const button = screen.getByRole('button', { name: 'Open image' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-description')).toBe('The material has no Height map.');
  });

  it('R55 the reason is also written beside the disabled button, for touch screens that have no tooltip', () => {
    render(<OpenImageButton shading="height" mapsState={state} readBlob={readBlob} />);
    expect(screen.getByText('The material has no Height map.').tagName).toBe('SPAN');
  });

  it('R55 a map the project has shows no reason text', () => {
    render(<OpenImageButton shading="normal" mapsState={state} readBlob={readBlob} />);
    expect(screen.queryByText(/has no/)).toBeNull();
  });

  it('R55 changing the view while the viewer is open closes it', async () => {
    const { rerender } = render(<OpenImageButton shading="normal" mapsState={state} readBlob={readBlob} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open image' }));
    rerender(<OpenImageButton shading="lit" mapsState={state} readBlob={readBlob} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
