// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAgentSetupPrompt } from '../../../src/materialgen/tutorial/agentSetupPrompt';
import { WelcomeDialog } from '../../../src/materialgen/tutorial/WelcomeDialog';
import { GITHUB_URL, WEB_APP_URL } from '../../../src/materialgen/tutorial/welcomeLinks';

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'clipboard');
});

const setup = () => {
  const handlers = { onStartTour: vi.fn(), onGenerateMaterial: vi.fn(), onClose: vi.fn() };
  render(<WelcomeDialog open {...handlers} />);
  return handlers;
};

const setClipboard = (writeText: (text: string) => Promise<void>): void => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
};

describe('materialgen/tutorial WelcomeDialog (R14, R15, R16)', () => {
  it('TestR14_it_is_a_dialog_titled_welcome_to_pbrtopia_with_the_parts_of_the_words', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Welcome to pbrtopia' });
    expect(dialog.textContent).toContain('Gemini');
    expect(dialog.textContent).toContain('www.pbrtopia.com');
  });

  it('TestR14_nothing_shows_while_closed', () => {
    render(<WelcomeDialog open={false} onStartTour={vi.fn()} onGenerateMaterial={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('TestR14_the_web_and_github_links_open_in_a_new_tab_without_giving_the_page_away_and_github_carries_its_icon', () => {
    setup();
    const web = screen.getByRole('link', { name: /www\.pbrtopia\.com/ });
    const github = screen.getByRole('link', { name: /GitHub/ });
    expect(web.getAttribute('href')).toBe(WEB_APP_URL);
    expect(github.getAttribute('href')).toBe(GITHUB_URL);
    for (const link of [web, github]) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
    expect(github.querySelector('[data-icon="github"]')).not.toBeNull();
  });

  it('TestR14_escape_closes_it_and_a_click_outside_does_not', () => {
    const { onClose } = setup();
    fireEvent.mouseDown(document.body);
    fireEvent.click(document.body);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('TestR15_the_two_buttons_do_their_own_thing_and_nothing_else', () => {
    const { onStartTour, onGenerateMaterial, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Start with tutorial' }));
    expect(onStartTour).toHaveBeenCalledTimes(1);
    expect(onGenerateMaterial).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Generate material' }));
    expect(onGenerateMaterial).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled(); // the owner closes it when it handles a button
  });

  it('TestR16_copy_puts_the_agent_prompt_on_the_clipboard_and_says_copied', async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard(writeText);
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy instructions for an agent/ }));
    });
    expect(writeText).toHaveBeenCalledExactlyOnceWith(buildAgentSetupPrompt(GITHUB_URL));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('TestR16_a_refused_clipboard_says_copy_failed', async () => {
    setClipboard(async () => {
      throw new Error('denied');
    });
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy instructions for an agent/ }));
    });
    expect(screen.getByRole('button', { name: 'Copy failed' })).toBeTruthy();
  });

  it('TestR16_a_missing_clipboard_says_copy_failed_and_does_not_throw', async () => {
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy instructions for an agent/ }));
    });
    expect(screen.getByRole('button', { name: 'Copy failed' })).toBeTruthy();
  });
});
