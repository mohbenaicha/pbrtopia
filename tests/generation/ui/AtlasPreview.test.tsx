// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AtlasPreview } from '../../../src/generation/ui/AtlasPreview';

const created: Blob[] = [];
const revoked: string[] = [];

beforeEach(() => {
  created.length = 0;
  revoked.length = 0;
  URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
    created.push(blob as Blob);
    return `blob:atlas-${created.length}`;
  });
  URL.revokeObjectURL = vi.fn((url: string) => void revoked.push(url));
});
afterEach(cleanup);

describe('AtlasPreview (R10)', () => {
  it('R10 shows nothing before there is an atlas', () => {
    render(<AtlasPreview atlas={null} />);
    expect(screen.queryByTestId('atlas-preview')).toBeNull();
  });

  it('R10 shows the atlas as a picture and lets go of it when it goes away', () => {
    const atlas = new Blob(['atlas']);
    const view = render(<AtlasPreview atlas={atlas} />);
    expect(screen.getByRole('img', { name: /captured views/i })).toHaveProperty('src', 'blob:atlas-1');
    expect(created).toEqual([atlas]);
    view.rerender(<AtlasPreview atlas={null} />);
    expect(screen.queryByTestId('atlas-preview')).toBeNull();
    expect(revoked).toEqual(['blob:atlas-1']);
  });
});
