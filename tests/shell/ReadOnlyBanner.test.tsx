// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ReadOnlyBanner } from '../../src/shell/ReadOnlyBanner';

afterEach(cleanup);

describe('ReadOnlyBanner', () => {
  it('R4 it says the project is open in another tab and that changes are not saved here', () => {
    render(<ReadOnlyBanner />);
    expect(screen.getByRole('status').textContent).toBe('This project is open in another tab, so changes are not saved here.');
  });
});
