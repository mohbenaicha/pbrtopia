// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EnhancedPromptBlock } from '../../../src/generation/ui/EnhancedPromptBlock';

afterEach(cleanup);

describe('EnhancedPromptBlock (R12)', () => {
  it('R12 renders nothing while there is no enhanced prompt', () => {
    const { container } = render(<EnhancedPromptBlock text={null} />);
    expect(container.textContent).toBe('');
  });

  it('R12 shows the enhanced prompt under its title, open by default', () => {
    render(<EnhancedPromptBlock text="A stone with moss on the left." />);
    expect(screen.getByRole('button', { name: 'Enhanced prompt' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('A stone with moss on the left.')).toBeTruthy();
  });

  it('R12 can be collapsed', () => {
    render(<EnhancedPromptBlock text="A stone." />);
    fireEvent.click(screen.getByRole('button', { name: 'Enhanced prompt' }));
    expect(screen.queryByText('A stone.')).toBeNull();
  });

  it('R12 shows provider text as plain text, never as markup', () => {
    render(<EnhancedPromptBlock text="<img src=x onerror=alert(1)> done" />);
    expect(screen.getByText('<img src=x onerror=alert(1)> done')).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();
  });

  it('R12 an empty string counts as no prompt', () => {
    const { container } = render(<EnhancedPromptBlock text="" />);
    expect(container.textContent).toBe('');
  });
});
