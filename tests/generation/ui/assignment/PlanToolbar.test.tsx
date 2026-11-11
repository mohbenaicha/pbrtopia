// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanToolbar } from '../../../../src/generation';

afterEach(cleanup);

const presets = [{ id: 'one', label: 'Preset one' }];
const savedSetups = [{ name: 'Mine', plan: 1 }];

function show(chosenSetup: string | null) {
  const handlers = { onSyncSettingsChange: vi.fn(), onPreset: vi.fn(), onLoad: vi.fn(), onDelete: vi.fn(), onSave: vi.fn() };
  render(<PlanToolbar presets={presets} activePreset="custom" chosenSetup={chosenSetup} presetsEnabled savedSetups={savedSetups} syncSettings={false} namePlaceholder="Name it" {...handlers} />);
  return handlers;
}

describe('shared/materialgen-prep plan toolbar', () => {
  it('R22 with a chosen saved setup from the host the Delete setup button deletes it by name', () => {
    const handlers = show('Mine');
    fireEvent.click(screen.getByRole('button', { name: 'Delete setup' }));
    expect(handlers.onDelete).toHaveBeenCalledWith('Mine');
  });

  it('R22 with no chosen setup there is no Delete setup button', () => {
    show(null);
    expect(screen.queryByRole('button', { name: 'Delete setup' })).toBeNull();
  });

  it('R22 a name already used asks before replacing, hides the naming dialog meanwhile and brings it back with the typed name on Cancel', () => {
    const handlers = show(null);
    fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.getByText('Replace setup "Mine"?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Mine');
    expect(handlers.onSave).not.toHaveBeenCalled();
  });

  it('R22 confirming the replace saves under that name and closes both', () => {
    const handlers = show(null);
    fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(handlers.onSave).toHaveBeenCalledWith('Mine');
    expect(screen.queryByLabelText('Name')).toBeNull();
  });
});
