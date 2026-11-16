// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from '../../src/ui-kit';

const sizeOf = (container: HTMLElement): string => (container.querySelector('.ui-icon') as HTMLElement).style.getPropertyValue('--icon-size');

describe('Icon (viewport-layout R36)', () => {
  it('viewport-layout R36 a line icon with no size is 30 px', () => {
    const { container } = render(<Icon name="trash" />);
    expect(sizeOf(container)).toBe('30px');
  });

  it('viewport-layout R36 a supplied image icon with no size is 26 px', () => {
    const { container } = render(<Icon name="perspective" />);
    expect(sizeOf(container)).toBe('26px');
  });

  it('tutorial R14 the github icon is a filled mark, not a stroked line drawing', () => {
    const { container } = render(<Icon name="github" size={20} />);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('fill')).toBe('currentColor');
    expect(svg.getAttribute('stroke')).toBeNull();
    expect(sizeOf(container)).toBe('20px');
  });

  it('viewport-layout R36 an explicit size wins', () => {
    const { container } = render(<Icon name="download" size={16} />);
    expect(sizeOf(container)).toBe('16px');
  });
});
