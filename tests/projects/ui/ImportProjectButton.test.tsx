// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportProjectButton, type ProjectImportState } from '../../../src/projects/ui/ImportProjectButton';

afterEach(cleanup);

const idle = (overrides: Partial<ProjectImportState> = {}): ProjectImportState => ({ importing: false, progress: null, message: null, error: null, start: vi.fn(async () => undefined), ...overrides });

describe('ImportProjectButton', () => {
  it('projects R12 the picker takes zip files and a picked file starts the import', () => {
    const state = idle();
    render(<ImportProjectButton state={state} />);
    expect(screen.getByRole('button', { name: 'Import project' })).toBeTruthy();
    const input = screen.getByTestId('project-zip-input');
    expect(input.getAttribute('accept')).toContain('.zip');
    const file = new File(['zip'], 'helmet.texturelab.zip');
    fireEvent.change(input, { target: { files: [file] } });
    expect(state.start).toHaveBeenCalledWith(file);
  });

  it('projects R12 while importing the button is busy and the progress shows as a percentage', () => {
    render(<ImportProjectButton state={idle({ importing: true, progress: 0.42 })} />);
    expect(screen.getByRole('button', { name: /Import project/ }).getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toContain('42%');
  });

  it('projects R12 shows the result line and the typed error', () => {
    const { rerender } = render(<ImportProjectButton state={idle({ message: 'Imported Helmet.' })} />);
    expect(screen.getByRole('status').textContent).toBe('Imported Helmet.');
    rerender(<ImportProjectButton state={idle({ error: 'This file is not a project export.' })} />);
    expect(screen.getByRole('alert').textContent).toBe('This file is not a project export.');
  });
});
