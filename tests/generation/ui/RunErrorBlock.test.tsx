// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunError } from '../../../src/generation/generateStore';
import { RunErrorBlock } from '../../../src/generation/ui/RunErrorBlock';

afterEach(cleanup);

const server: RunError = { category: 'server', retryable: true, message: 'The provider is busy or could not finish. Try again.' };

function setup(error: RunError) {
  const onRetry = vi.fn();
  render(<RunErrorBlock error={error} onRetry={onRetry} />);
  return { onRetry };
}

describe('RunErrorBlock (R9)', () => {
  it('R9 shows the fixed message as an alert', () => {
    setup(server);
    expect(screen.getByRole('alert').textContent).toContain('The provider is busy or could not finish. Try again.');
  });

  it('R9 a retryable error has a Retry button that calls onRetry once', () => {
    const { onRetry } = setup(server);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('R9 a non-retryable error has no Retry and tells the user to change the inputs', () => {
    setup({ category: 'moderation', retryable: false, message: 'Blocked.' });
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Change the inputs, then press Generate.');
  });

  it('R9 the provider text is hidden until the details are opened, and shown as plain text', () => {
    setup({ ...server, details: '<b>quota</b> & <script>alert(1)</script>' });
    expect(screen.queryByText(/quota/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Provider details' }));
    expect(screen.getByText('<b>quota</b> & <script>alert(1)</script>')).toBeTruthy();
    expect(document.querySelector('script')).toBeNull();
  });

  it('R9 an error without provider text has no details disclosure', () => {
    setup(server);
    expect(screen.queryByRole('button', { name: 'Provider details' })).toBeNull();
  });

  it('R9 a rate limit says how long to wait, rounded up to whole seconds', () => {
    setup({ category: 'rate-limit', retryable: true, message: 'Too many requests.', retryAfterMs: 29_500 });
    expect(screen.getByRole('alert').textContent).toContain('Wait about 30 s before retrying.');
  });

  it('R9 no wait sentence for other errors', () => {
    setup(server);
    expect(screen.getByRole('alert').textContent).not.toMatch(/Wait about/);
  });
});
