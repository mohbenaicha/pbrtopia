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

const normalRow = (patch: Partial<RunLogRecord> = {}): RunLogRecord => ({
  id: 'n1',
  projectId: 'p1',
  startedAt: new Date(2026, 10, 20, 14, 5, 9).getTime(),
  modelLabel: 'GPT Image 2.5 Sunburst',
  outcome: 'done',
  prompt: 'the normal prompt text',
  atlas: new Blob(['sent']),
  enhancedPrompt: null,
  imagePreview: new Blob(['returned']),
  sheets: [],
  errorMessage: null,
  errorDetails: null,
  normal: { detail: 3, quality: 'low' },
  ...patch,
});

function open(record: RunLogRecord): void {
  render(<DebugTab projectId="p1" records={[record]} revealId={null} revealCount={0} onRemove={() => undefined} />);
  fireEvent.click(screen.getByRole('button', { name: /GPT Image 2.5 Sunburst/ }));
}

describe('run log row of a normal-map run (normal-map R12)', () => {
  it('normal-map R12 shows the sheet sent, the height map returned, the normal map made, the model, quality, Detail and the prompt sent', () => {
    open(normalRow({ normal: { detail: 3, quality: 'low', made: new Blob(['made']) } }));
    expect(screen.getByRole('img', { name: 'Upright sheet sent to the model' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Height map returned' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Normal map made' })).toBeTruthy();
    expect(screen.getByText('the normal prompt text')).toBeTruthy();
    expect(screen.getByText('Low quality')).toBeTruthy();
    expect(screen.getByText('Detail 3: Fine')).toBeTruthy();
    expect(screen.getByRole('button', { name: /GPT Image 2.5 Sunburst/ }).textContent).toContain('GPT Image 2.5 Sunburst');
  });

  it('normal-map R12 has no enhanced prompt and no atlas label', () => {
    open(normalRow());
    expect(screen.queryByText('Enhanced prompt')).toBeNull();
    expect(screen.queryByText('Atlas')).toBeNull();
  });

  it('normal-map R12 a model with no quality levels shows no quality line', () => {
    open(normalRow({ normal: { detail: 1, quality: null } }));
    expect(screen.queryByText(/quality/i)).toBeNull();
    expect(screen.getByText('Detail 1: Broad forms')).toBeTruthy();
  });
});

describe('runLogStore for a normal-map run (normal-map R12)', () => {
  it('normal-map R12 setNormalMade keeps the normal map made on the row, and a retried run starts without it', () => {
    const log = createRunLogStore();
    const id = log.getState().begin({ projectId: 'p1', modelLabel: 'm', prompt: 'p', startedAt: 1, normal: { detail: 2, quality: null } });
    log.getState().setNormalMade(id, new Blob(['made']));
    expect(log.getState().records[0]?.normal?.made).toBeInstanceOf(Blob);
    log.getState().finish(id, 'failed', { message: 'x' });
    log.getState().resume(id);
    expect(log.getState().records[0]?.normal).toMatchObject({ detail: 2 });
    expect(log.getState().records[0]?.normal?.made ?? null).toBeNull();
  });

  it('normal-map R12 a row begun with normal settings keeps them, and a row begun without has none', () => {
    const log = createRunLogStore();
    const id = log.getState().begin({ projectId: 'p1', modelLabel: 'm', prompt: 'p', startedAt: 1, normal: { detail: 4, quality: null } });
    expect(log.getState().records[0]).toMatchObject({ id, normal: { detail: 4, quality: null }, enhancedPrompt: null });
    const plain = log.getState().begin({ projectId: 'p1', modelLabel: 'm', prompt: 'p', startedAt: 2 });
    expect(log.getState().records.find((record) => record.id === plain)?.normal ?? null).toBeNull();
  });
});
