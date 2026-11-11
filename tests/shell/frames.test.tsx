// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeftPanel, TopBar } from '../../src/shell';

afterEach(cleanup);

describe('shared/materialgen-prep R53 shell frames hold no app words', () => {
  const bar = { onOpenProjects: () => undefined, onOpenSettings: () => undefined, settingsDisabledReason: null, onExportProject: () => undefined, exporting: false, exportDisabledReason: null };

  it('R53 the top bar shows the fallback title until there is a name, and the extra actions sit between Export project and Settings', () => {
    render(<TopBar {...bar} projectName={null} fallbackTitle="material-lab" extraActions={<button aria-label="Mine">m</button>} />);
    expect(within(screen.getByTestId('top-bar')).getByText('material-lab')).toBeTruthy();
    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    expect(names).toEqual(['Projects', 'Export project', 'Mine', 'Settings']);
  });

  it('R53 the top bar shows the project name when there is one', () => {
    render(<TopBar {...bar} projectName="Brick" fallbackTitle="material-lab" />);
    expect(screen.getByTestId('top-bar').textContent).toContain('Brick');
    expect(screen.queryByText('material-lab')).toBeNull();
  });

  it('R53 the left panel takes any tab list and reports the chosen tab', async () => {
    const onTabChange = vi.fn();
    render(
      <LeftPanel
        label="Maps"
        tabs={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta' },
        ]}
        tab="a"
        onTabChange={onTabChange}
        content={{ a: <p>alpha body</p>, b: <p>beta body</p> }}
      />,
    );
    expect(screen.getByRole('tablist', { name: 'Maps' })).toBeTruthy();
    expect(screen.getByText('alpha body')).toBeTruthy();
    expect(screen.queryByText('beta body')).toBeNull();
    await userEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(onTabChange).toHaveBeenCalledWith('b');
  });
});
