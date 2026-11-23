// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseOption, setupOverlay } from './setupHarness';

afterEach(cleanup);

const toolbar = (): HTMLElement => document.querySelector('.setup-toolbar') as HTMLElement;
const renderBox = (): HTMLButtonElement => within(toolbar()).getByRole('combobox', { name: 'Atlas render' }) as HTMLButtonElement;

describe('the Atlas render dropdown in the setup toolbar (custom R52)', () => {
  it('custom R52 sits in the toolbar and shows the panel value', () => {
    setupOverlay({ atlasRender: 'wireframe' });
    expect(renderBox().textContent).toContain('Wireframe');
  });

  it('custom R52 lists the five renders of Additional settings', () => {
    setupOverlay();
    fireEvent.click(renderBox());
    const labels = within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent);
    expect(labels).toEqual(['Default (grey)', 'Wireframe', 'Depth', 'Depth + wireframe', 'Current viewport']);
  });

  it('custom R52 picking a render tells the host', () => {
    const onAtlasRenderChange = vi.fn();
    setupOverlay({ onAtlasRenderChange });
    chooseOption('Atlas render', 'Depth');
    expect(onAtlasRenderChange).toHaveBeenCalledWith('depth');
  });

  it('custom R52 for Metal-Roughness it shows the fixed mask look, disabled', () => {
    setupOverlay({ auxiliary: false });
    expect(renderBox().disabled).toBe(true);
    expect(renderBox().textContent).not.toContain('Wireframe');
  });
});
