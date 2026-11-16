import { describe, expect, it } from 'vitest';
import { parseTutorialText } from '../../../src/tutorial/tutorialText';
import welcomeSource from '../../../src/materialgen/tutorial/welcome-text.md?raw';
import { buildAgentSetupPrompt } from '../../../src/materialgen/tutorial/agentSetupPrompt';
import { GITHUB_URL, WEB_APP_URL } from '../../../src/materialgen/tutorial/welcomeLinks';

const texts = parseTutorialText(welcomeSource);
const allWords = Object.values(texts).flatMap((text) => [text.heading, ...text.paragraphs]).join('\n');

describe('materialgen/tutorial welcome words (R14, R17)', () => {
  it('TestR14_the_words_file_has_exactly_the_welcome_parts_in_the_order_written', () => {
    expect(Object.keys(texts)).toEqual(['title', 'what', 'needs', 'where', 'privacy']);
    expect(texts.title?.heading).toBe('Welcome to pbrtopia');
    for (const id of ['what', 'needs', 'where', 'privacy']) expect(texts[id]?.paragraphs.length, id).toBeGreaterThan(0);
  });

  it('TestR14_the_words_name_the_two_providers_the_web_address_and_the_privacy_facts', () => {
    expect(allWords).toContain('Gemini');
    expect(allWords).toContain('OpenAI');
    expect(allWords).toContain('www.pbrtopia.com');
    expect(allWords).toContain('uploaded');
    expect(allWords).toContain('never stored');
  });

  it('TestR17_the_links_are_the_real_web_app_and_the_mirror_repository', () => {
    expect(GITHUB_URL).toBe('https://github.com/mohbenaicha/pbrtopia');
    expect(WEB_APP_URL).toBe('https://www.pbrtopia.com');
  });
});

describe('materialgen/tutorial agent setup prompt (R16)', () => {
  const prompt = buildAgentSetupPrompt(GITHUB_URL);

  it('TestR16_the_prompt_tells_an_agent_to_clone_or_download_the_release_and_to_ask_for_a_key_in_settings', () => {
    expect(prompt).toContain(GITHUB_URL);
    expect(prompt.toLowerCase()).toContain('clone');
    expect(prompt.toLowerCase()).toContain('release');
    expect(prompt).toContain('Gemini');
    expect(prompt).toContain('OpenAI');
    expect(prompt).toContain('Settings');
  });

  it('TestR16_the_prompt_holds_no_key_shaped_text', () => {
    expect(prompt).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(prompt).not.toMatch(/AIza[A-Za-z0-9_-]{10}/);
  });
});
