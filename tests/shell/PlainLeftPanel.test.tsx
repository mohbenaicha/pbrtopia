// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlainLeftPanel } from '../../src/shell';

afterEach(cleanup);

describe('PlainLeftPanel', () => {
  it('materialgen-prep R66 it draws its children in the left panel body with no tab strip', () => {
    render(<PlainLeftPanel><p>Fields</p></PlainLeftPanel>);
    const panel = screen.getByTestId('left-panel');
    expect(panel.querySelector('.left-panel__body')?.textContent).toBe('Fields');
    expect(panel.querySelector('.left-panel__tabs')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
  });
});
