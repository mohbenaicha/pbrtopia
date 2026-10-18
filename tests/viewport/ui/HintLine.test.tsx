// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HintLine } from '../../../src/viewport/ui/HintLine';

afterEach(cleanup);

describe('HintLine', () => {
  it('R16 it reads "Right-drag orbit, middle-drag pan, scroll zoom"', () => {
    render(<HintLine />);
    expect(screen.getByText('Right-drag orbit, middle-drag pan, scroll zoom')).toBeTruthy();
  });
});
