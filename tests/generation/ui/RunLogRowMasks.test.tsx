// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRunLogStore, type RunLogRecord } from '../../../src/generation/runLogStore';
import { DebugTab } from '../../../src/generation/ui/DebugTab';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:log');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const maskRow = (patch: Partial<RunLogRecord> = {}): RunLogRecord => ({
  id: 'm1',
  projectId: 'p1',
  startedAt: new Date(2026, 10, 20, 14, 5, 9).getTime(),
  modelLabel: 'Nano Banana 2.1',
  outcome: 'done',
  prompt: 'a worn chest',
  atlas: new Blob(['atlas']),
  enhancedPrompt: null,
  imagePreview: new Blob(['returned']),
  sheets: [],
  errorMessage: null,
  errorDetails: null,
  masks: {
    sheet: new Blob(['sheet']),
    components: [
      { name: 'Wood', description: 'oak planks', location: 'front: base', hex: '#FF0000' },
      { name: 'Steel', description: 'brushed band', location: 'top: rim', hex: '#00FF00' },
    ],
  },
  ...patch,
});

function open(record: RunLogRecord): void {
  render(<DebugTab projectId="p1" records={[record]} revealId={null} revealCount={0} onRemove={() => undefined} />);
  fireEvent.click(screen.getByRole('button', { name: /Nano Banana 2.1/ }));
}

describe('run log row of a mask run (mask-generation R13)', () => {
  it('mask-generation R13 shows the labelled sheet, the atlas sent and the image returned', () => {
    open(maskRow());
    expect(screen.getByRole('img', { name: 'Labelled sheet sent to the describe model' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Atlas sent to the model' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Image returned by the model' })).toBeTruthy();
  });

  it('mask-generation R13 lists every component with its name, description, location and a swatch of its colour', () => {
    open(maskRow());
    expect(screen.getByText('Wood')).toBeTruthy();
    expect(screen.getByText('oak planks')).toBeTruthy();
    expect(screen.getByText('front: base')).toBeTruthy();
    const swatches = screen.getAllByTestId('component-swatch') as HTMLElement[];
    expect(swatches.map((swatch) => swatch.style.backgroundColor)).toEqual(['rgb(255, 0, 0)', 'rgb(0, 255, 0)']);
  });

  it('mask-generation R13 has no enhanced prompt field, and the user text is captioned as the description of the materials', () => {
    open(maskRow());
    expect(screen.queryByText('Enhanced prompt')).toBeNull();
    expect(screen.getByText('Describe the materials')).toBeTruthy();
    expect(screen.getByText('a worn chest')).toBeTruthy();
  });

  it('mask-generation R13 a run that failed before describe shows no sheet and no components, only what it has', () => {
    open(maskRow({ outcome: 'failed', atlas: null, imagePreview: null, errorMessage: 'The describe model did not return a usable list of components.', masks: { sheet: null, components: [] } }));
    expect(screen.queryByRole('img', { name: 'Labelled sheet sent to the describe model' })).toBeNull();
    expect(screen.queryAllByTestId('component-swatch')).toHaveLength(0);
    expect(screen.getByText('The describe model did not return a usable list of components.')).toBeTruthy();
  });
});

describe('runLogStore for a mask run (mask-generation R13)', () => {
  it('mask-generation R13 a row begun as a mask run starts with no sheet and no components; each is set as it is made', () => {
    const log = createRunLogStore();
    const id = log.getState().begin({ projectId: 'p1', modelLabel: 'm', prompt: 'p', startedAt: 1, masks: true });
    expect(log.getState().records[0]!.masks).toEqual({ sheet: null, components: [] });
    const sheet = new Blob(['s']);
    log.getState().setMaskSheet(id, sheet);
    log.getState().setMaskComponents(id, [{ name: 'a', description: 'b', location: 'c', hex: '#FF0000' }]);
    expect(log.getState().records[0]!.masks).toEqual({ sheet, components: [{ name: 'a', description: 'b', location: 'c', hex: '#FF0000' }] });
  });

  it('mask-generation R13, R11 a Retry that continues the row starts it clean: the sheet and components are fed in again by the retried run', () => {
    const log = createRunLogStore();
    const id = log.getState().begin({ projectId: 'p1', modelLabel: 'm', prompt: 'p', startedAt: 1, masks: true });
    log.getState().setMaskSheet(id, new Blob(['s']));
    log.getState().finish(id, 'failed', { message: 'x' });
    expect(log.getState().resume(id)).toBe(true);
    expect(log.getState().records[0]!.masks).toEqual({ sheet: null, components: [] });
  });

  it('mask-generation R13 a row that is not a mask run has no mask part, and setting one on it changes nothing', () => {
    const log = createRunLogStore();
    const id = log.getState().begin({ projectId: 'p1', modelLabel: 'm', prompt: 'p', startedAt: 1 });
    log.getState().setMaskSheet(id, new Blob(['s']));
    expect(log.getState().records[0]!.masks).toBeUndefined();
  });
});
