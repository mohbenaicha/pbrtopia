// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunLogRecord } from '../../../src/generation/runLogStore';
import { DebugTab } from '../../../src/generation/ui/DebugTab';

const created: Blob[] = [];
const revoked: string[] = [];

beforeEach(() => {
  created.length = 0;
  revoked.length = 0;
  URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
    created.push(blob as Blob);
    return `blob:log-${created.length}`;
  });
  URL.revokeObjectURL = vi.fn((url: string) => void revoked.push(url));
});
afterEach(cleanup);

const record = (patch: Partial<RunLogRecord> = {}): RunLogRecord => ({
  id: 'r1',
  projectId: 'p1',
  startedAt: new Date(2026, 9, 26, 14, 5, 9).getTime(),
  modelLabel: 'Gemini 3 Pro Image',
  outcome: 'done',
  prompt: 'a mossy stone',
  atlas: new Blob(['atlas']),
  enhancedPrompt: 'A mossy grey stone, moss on the left.',
  imagePreview: new Blob(['image']),
  errorMessage: null,
  errorDetails: null,
  ...patch,
});

function show(records: RunLogRecord[], extra: { revealId?: string | null; revealCount?: number; onRemove?: (id: string) => void; projectId?: string } = {}) {
  const onRemove = extra.onRemove ?? vi.fn();
  const props = { projectId: extra.projectId ?? 'p1', records, revealId: extra.revealId ?? null, revealCount: extra.revealCount ?? 0, onRemove };
  const view = render(<DebugTab {...props} />);
  return { onRemove, rerender: (next: Partial<typeof props>) => view.rerender(<DebugTab {...props} {...next} />) };
}

const header = (name: RegExp | string): HTMLElement => screen.getByRole('button', { name });

describe('DebugTab: the list (R24, R26)', () => {
  it('R24 says so when the open project has no rows', () => {
    show([]);
    expect(screen.getByText('No generations for this project yet.')).toBeTruthy();
  });

  it('R26 lists only the open project\'s rows, in the order given (newest first)', () => {
    show([record({ id: 'a', modelLabel: 'Model A' }), record({ id: 'b', projectId: 'other', modelLabel: 'Model B' }), record({ id: 'c', modelLabel: 'Model C' })]);
    const titles = screen.getAllByRole('button', { name: /Model/ }).map((button) => button.textContent ?? '');
    expect(titles).toHaveLength(2);
    expect(titles[0]).toContain('Model A');
    expect(titles[1]).toContain('Model C');
  });

  it('R24 a project with rows only in other projects shows the empty text', () => {
    show([record({ projectId: 'other' })]);
    expect(screen.getByText('No generations for this project yet.')).toBeTruthy();
  });
});

describe('DebugTab: a row (R24)', () => {
  it('R24 is collapsed by default: the header shows time, model and outcome and nothing of the body is drawn', () => {
    show([record()]);
    const button = header(/Gemini 3 Pro Image/);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(button.textContent).toContain('Done');
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText('a mossy stone')).toBeNull();
  });

  it('R24 shows the outcome as Running, Done, Failed or Cancelled', () => {
    show([record({ id: '1', outcome: 'running', modelLabel: 'M1' }), record({ id: '2', outcome: 'failed', modelLabel: 'M2' }), record({ id: '3', outcome: 'cancelled', modelLabel: 'M3' })]);
    expect(header(/M1/).textContent).toContain('Running');
    expect(header(/M2/).textContent).toContain('Failed');
    expect(header(/M3/).textContent).toContain('Cancelled');
  });

  it('R24 opened it shows the atlas, the prompt, the enhanced prompt and the image preview', () => {
    const row = record();
    show([row]);
    fireEvent.click(header(/Gemini/));
    expect(header(/Gemini/).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('img', { name: /atlas/i })).toHaveProperty('src', 'blob:log-1');
    expect(screen.getByRole('img', { name: /generated image/i })).toHaveProperty('src', 'blob:log-2');
    expect(created).toEqual([row.atlas, row.imagePreview]);
    expect(screen.getByText('a mossy stone')).toBeTruthy();
    expect(screen.getByText('A mossy grey stone, moss on the left.')).toBeTruthy();
  });

  it('R24 a part the run did not produce is not shown', () => {
    show([record({ outcome: 'running', atlas: null, enhancedPrompt: null, imagePreview: null })]);
    fireEvent.click(header(/Gemini/));
    expect(screen.getByText('a mossy stone')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText(/Enhanced prompt/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('R24 a failed row shows the message and the provider details, as plain text, and no image when it has none', () => {
    show([record({ outcome: 'failed', imagePreview: null, errorMessage: 'The image model refused the request.', errorDetails: '<img src=x onerror=alert(1)> policy 7' })]);
    fireEvent.click(header(/Gemini/));
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('The image model refused the request.');
    expect(within(alert).getByText('<img src=x onerror=alert(1)> policy 7')).toBeTruthy();
    expect(screen.queryByRole('img', { name: /generated image/i })).toBeNull();
    expect(document.querySelector('img[onerror]')).toBeNull();
  });

  it('R24 a failed row without provider details shows only the message', () => {
    show([record({ outcome: 'failed', errorMessage: 'Validation failed.' })]);
    fireEvent.click(header(/Gemini/));
    expect(screen.getByRole('alert').textContent).toBe('Validation failed.');
  });

  it('R24 collapsing a row lets go of its picture addresses', () => {
    show([record()]);
    fireEvent.click(header(/Gemini/));
    fireEvent.click(header(/Gemini/));
    expect(revoked.sort()).toEqual(['blob:log-1', 'blob:log-2']);
  });

  it('R24 the prompts are plain text, never markup', () => {
    show([record({ prompt: '<b>bold</b>', enhancedPrompt: '<script>x</script>' })]);
    fireEvent.click(header(/Gemini/));
    expect(screen.getByText('<b>bold</b>')).toBeTruthy();
    expect(document.querySelector('b, script')).toBeNull();
  });
});

describe('DebugTab: delete (R26)', () => {
  it('R26 the delete button removes that row and does not open it', () => {
    const { onRemove } = show([record({ id: 'a', modelLabel: 'Model A' }), record({ id: 'b', modelLabel: 'Model B' })]);
    const rowB = header(/Model B/).closest('section') as HTMLElement;
    fireEvent.click(within(rowB).getByRole('button', { name: 'Delete log row' }));
    expect(onRemove).toHaveBeenCalledWith('b');
    expect(header(/Model B/).getAttribute('aria-expanded')).toBe('false');
  });

  it('R26 the delete button is disabled while the row runs, with the reason', () => {
    show([record({ outcome: 'running' })]);
    const button = screen.getByRole('button', { name: 'Delete log row' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toMatch(/still going|running/i);
  });
});

describe('DebugTab: opening a row from the step list (R27)', () => {
  it('R27 a reveal opens that row and leaves the others as they were', () => {
    const rows = [record({ id: 'a', modelLabel: 'Model A' }), record({ id: 'b', modelLabel: 'Model B' }), record({ id: 'c', modelLabel: 'Model C' })];
    const { rerender } = show(rows);
    fireEvent.click(header(/Model A/));
    rerender({ revealId: 'c', revealCount: 1 });
    expect(header(/Model A/).getAttribute('aria-expanded')).toBe('true');
    expect(header(/Model B/).getAttribute('aria-expanded')).toBe('false');
    expect(header(/Model C/).getAttribute('aria-expanded')).toBe('true');
  });

  it('R27 a second reveal of the same row opens it again after the user closed it', () => {
    const rows = [record({ id: 'a', modelLabel: 'Model A' })];
    const { rerender } = show(rows);
    rerender({ revealId: 'a', revealCount: 1 });
    expect(header(/Model A/).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(header(/Model A/));
    expect(header(/Model A/).getAttribute('aria-expanded')).toBe('false');
    rerender({ revealId: 'a', revealCount: 2 });
    expect(header(/Model A/).getAttribute('aria-expanded')).toBe('true');
  });

  it('R27 a reveal scrolls the row into view', () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    const { rerender } = show([record({ id: 'a', modelLabel: 'Model A' })]);
    rerender({ revealId: 'a', revealCount: 1 });
    expect(scrolled).toHaveBeenCalled();
  });

  it('R27 a reveal of a row that is not in the list changes nothing', () => {
    const { rerender } = show([record({ id: 'a', modelLabel: 'Model A' })]);
    rerender({ revealId: 'gone', revealCount: 1 });
    expect(header(/Model A/).getAttribute('aria-expanded')).toBe('false');
  });
});

describe('DebugTab: the pictures (R24, viewport-layout R33)', () => {
  const clicked: { name: string }[] = [];
  beforeEach(() => {
    clicked.length = 0;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ name: this.download });
    });
  });
  afterEach(() => vi.restoreAllMocks());

  const openRow = (patch: Partial<RunLogRecord> = {}): void => {
    show([record({ atlas: new Blob(['atlas'], { type: 'image/png' }), imagePreview: new Blob(['image'], { type: 'image/jpeg' }), ...patch })]);
    fireEvent.click(header(/Gemini/));
  };

  it('R24 each picture has a Download button over its corner that saves it as atlas.<ext> or generated.<ext>', () => {
    openRow();
    fireEvent.click(screen.getByRole('button', { name: 'Download Atlas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download Generated image' }));
    expect(clicked.map((entry) => entry.name)).toEqual(['atlas.png', 'generated.jpg']);
  });

  it('R24 the label of a picture is a caption inside its frame, not a line under it', () => {
    openRow();
    const frame = screen.getByRole('button', { name: 'Enlarge Atlas' }).closest('figure')!;
    const caption = within(frame).getByText('Atlas');
    expect(caption.tagName).toBe('FIGCAPTION');
    expect(screen.getByRole('button', { name: 'Enlarge Atlas' }).nextElementSibling).toBe(caption); // the caption follows the picture inside the same frame
    expect(frame.contains(within(frame).getByRole('button', { name: 'Download Atlas' }))).toBe(true);
  });

  it('R24 a click on a picture opens it in the large viewer with Download, and Close puts the row back', () => {
    openRow();
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge Generated image' }));
    const viewer = screen.getByRole('dialog', { name: 'Generated image' });
    fireEvent.click(within(viewer).getByRole('button', { name: 'Download Generated image' }));
    expect(clicked.map((entry) => entry.name)).toEqual(['generated.jpg']);
    fireEvent.click(within(viewer).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('R24 the viewer shows the picture already made for the row and makes no second address', () => {
    openRow();
    const before = created.length;
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge Atlas' }));
    expect(created).toHaveLength(before);
  });
});
