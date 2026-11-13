// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BrandMark } from '../../src/shell/BrandMark';

afterEach(cleanup);

describe('the corner logo (branding R1)', () => {
  it('R1 shows the given logo fixed 20 px from the bottom left, 56 px high, at 70% opacity', () => {
    const { container } = render(<BrandMark src="/logo.png" />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/logo.png');
    expect(img?.style.position).toBe('fixed');
    expect(img?.style.left).toBe('20px');
    expect(img?.style.bottom).toBe('20px');
    expect(img?.style.height).toBe('56px');
    expect(img?.style.opacity).toBe('0.7');
  });

  it('R1 takes no clicks and is hidden from assistive tech, with empty alt text', () => {
    const { container } = render(<BrandMark src="/logo.png" />);
    const img = container.querySelector('img');
    expect(img?.style.pointerEvents).toBe('none');
    expect(img?.getAttribute('alt')).toBe('');
    expect(img?.getAttribute('aria-hidden')).toBe('true');
  });

  it('R1 sits above the floating panels', () => {
    const { container } = render(<BrandMark src="/logo.png" />);
    expect(Number(container.querySelector('img')?.style.zIndex)).toBeGreaterThan(1);
  });
});
