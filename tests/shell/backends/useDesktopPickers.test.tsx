// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppBackendsProvider, useDesktopPickers } from '../../../src/shell';
import { createDesktopBackends } from '../../../src/shell/backends/createDesktopBackends';

afterEach(cleanup);

function Probe(): React.JSX.Element {
  return <p>{useDesktopPickers() === undefined ? 'browser' : 'desktop'}</p>;
}

describe('useDesktopPickers (storage-backends R13)', () => {
  it('R13 is undefined where no provider is mounted', () => {
    render(<Probe />);
    expect(screen.getByText('browser')).toBeTruthy();
  });

  it('R13 gives the desktop backends\' pickers to the views under the provider', () => {
    const backends = createDesktopBackends({
      vaultStorage: { load: vi.fn(async () => null), save: vi.fn(async () => ({ ok: true as const })) } as never,
      location: { path: 'D:\Library', showInFolder: vi.fn(), change: vi.fn() } as never,
      pickers: { showSaveFilePicker: vi.fn(), showDirectoryPicker: vi.fn() },
    });
    render(
      <AppBackendsProvider backends={backends}>
        <Probe />
      </AppBackendsProvider>,
    );
    expect(screen.getByText('desktop')).toBeTruthy();
  });
});
