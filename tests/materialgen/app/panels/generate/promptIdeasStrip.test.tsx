// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PromptIdeasStrip } from '@mat/app/panels/generate/PromptIdeasStrip';
import { idleIdeas } from './fakeGeneration';

afterEach(cleanup);

const IDEAS = ['rusty steel with flaking blue paint and pitted edges', 'brushed steel plate, light scratches', 'dark oxidised iron, heavy scale'];

describe('PromptIdeasStrip', () => {
  it('materialgen/generation R71 before any set the strip holds the AI button alone', () => {
    render(<PromptIdeasStrip ideas={idleIdeas()} readOnlyReason={null} />);
    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Get prompt ideas']);
  });

  it('materialgen/generation R71 Get prompt ideas starts the request; blank field and busy are shown as disabled with the reason, and busy ignores clicks', () => {
    const request = vi.fn();
    const view = render(<PromptIdeasStrip ideas={idleIdeas({ request })} readOnlyReason={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Get prompt ideas' }));
    expect(request).toHaveBeenCalledTimes(1);
    view.rerender(<PromptIdeasStrip ideas={idleIdeas({ request, disabledReason: 'Write a prompt first' })} readOnlyReason={null} />);
    const blocked = screen.getByRole('button', { name: 'Get prompt ideas' }) as HTMLButtonElement;
    expect(blocked.disabled).toBe(true);
    expect(blocked.title).toContain('Write a prompt first');
    view.rerender(<PromptIdeasStrip ideas={idleIdeas({ request, busy: true })} readOnlyReason={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Get prompt ideas' }));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('materialgen/generation R73 with a set the strip reads Reset, 1, 2, 3, then the AI button', () => {
    render(<PromptIdeasStrip ideas={idleIdeas({ ideas: IDEAS, canReset: true })} readOnlyReason={null} />);
    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Reset', 'Idea 1', 'Idea 2', 'Idea 3', 'Get prompt ideas']);
  });

  it('materialgen/generation R73 a number shows its idea in full as the tooltip, clicking it picks that idea, and the selected one is drawn pressed', () => {
    const pick = vi.fn();
    render(<PromptIdeasStrip ideas={idleIdeas({ ideas: IDEAS, selected: 1, pick })} readOnlyReason={null} />);
    expect(screen.getByRole('button', { name: 'Idea 2' }).getAttribute('title')).toBe(IDEAS[1]);
    expect(screen.getByRole('button', { name: 'Idea 2' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Idea 1' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Idea 3' }));
    expect(pick).toHaveBeenCalledWith(2);
  });

  it('materialgen/generation R74 Reset is disabled with "Nothing to go back to" while the trail is empty, and restores when it is not', () => {
    const reset = vi.fn();
    const view = render(<PromptIdeasStrip ideas={idleIdeas({ ideas: IDEAS, canReset: false, reset })} readOnlyReason={null} />);
    const off = screen.getByRole('button', { name: 'Reset' }) as HTMLButtonElement;
    expect(off.disabled).toBe(true);
    expect(off.title).toContain('Nothing to go back to');
    view.rerender(<PromptIdeasStrip ideas={idleIdeas({ ideas: IDEAS, canReset: true, reset })} readOnlyReason={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('materialgen/generation R75 read-only disables every button with the read-only tooltip', () => {
    render(<PromptIdeasStrip ideas={idleIdeas({ ideas: IDEAS, canReset: true })} readOnlyReason="Open in another tab" />);
    for (const button of screen.getAllByRole('button') as HTMLButtonElement[]) {
      expect(button.disabled).toBe(true);
      expect(button.title).toContain('Open in another tab');
    }
  });
});
