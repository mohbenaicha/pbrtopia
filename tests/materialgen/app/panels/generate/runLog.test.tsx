// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageAttempt, RunLogRow } from '@mat/generation';
import { RunLogSection } from '@mat/app/panels/generate/RunLogSection';

afterEach(cleanup);

const attempt = (patch: Partial<ImageAttempt> = {}): ImageAttempt => ({
  jobId: 'image-1', label: 'Image 1 (Albedo)', maps: ['Albedo'], model: 'gemini-nano-banana-2.1', resolutionKey: '1K', quality: null, canvas: '1024 x 1024', layout: '1x1', tilePx: 1024,
  referenceNames: [], prompt: 'Make a flat albedo.\nMaterial: red brick', status: 'done', durationMs: 4200, mimeType: 'image/jpeg', returnedSize: '1024 x 1024', note: 'JPEG source', error: null, thumbnail: null, ...patch,
});

const row = (patch: Partial<RunLogRow> = {}): RunLogRow => ({
  id: 'run-1', startedAt: new Date(2026, 10, 10, 9, 5, 7).getTime(), userText: 'red brick', planSummary: '1 image - maps 1024 px - about $0.04', attempts: [attempt()], describeAttempts: [], message: 'Generated: Albedo', status: 'done', ...patch,
});

describe('materialgen/generation run log', () => {
  it('R68 with no run it says runs appear here', () => {
    render(<RunLogSection log={[]} />);
    expect(screen.getByText('Runs of this session appear here.')).toBeTruthy();
  });

  it('R68 a row shows the time, the plan summary and the status, and opens to the facts of each image', () => {
    render(<RunLogSection log={[row()]} />);
    const header = screen.getByRole('button', { name: '09:05:07 · 1 image - maps 1024 px - about $0.04 · done' });
    expect(header.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(header);
    expect(screen.getByText('red brick')).toBeTruthy();
    expect(screen.getByText(/gemini-nano-banana-2.1 · 1K · 1024 x 1024 · 1x1 · tile 1024 px · no references · image\/jpeg 1024 x 1024 · 4.2 s/)).toBeTruthy();
    expect(screen.getByText('JPEG source')).toBeTruthy();
  });

  it('R69 the prompt is shown exactly as sent with a Copy button', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<RunLogSection log={[row()]} />);
    fireEvent.click(screen.getByRole('button', { name: /09:05:07/ }));
    expect(document.querySelector('.run-log__prompt')!.textContent).toBe('Make a flat albedo.\nMaterial: red brick');
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
    expect(writeText).toHaveBeenCalledWith('Make a flat albedo.\nMaterial: red brick');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy());
  });

  it('R69 a retried run keeps both attempts, the failed one with its error', () => {
    render(<RunLogSection log={[row({ attempts: [attempt({ status: 'failed', error: 'The model returned the wrong size.', returnedSize: null, mimeType: null, note: null }), attempt()] })]} />);
    fireEvent.click(screen.getByRole('button', { name: /09:05:07/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Image 1 (Albedo): Failed')).toBeTruthy();
    expect(screen.getByText('The model returned the wrong size.')).toBeTruthy();
    expect(screen.getByText('Image 1 (Albedo): Done')).toBeTruthy();
  });

  it('R68 the describe step has its own line', () => {
    render(<RunLogSection log={[row({ describeAttempts: [{ status: 'done', durationMs: 1500, answerLength: 420, error: null }] })]} />);
    fireEvent.click(screen.getByRole('button', { name: /09:05:07/ }));
    expect(screen.getByText('Describe step: Done, 1.5 s, 420 characters')).toBeTruthy();
  });
});
