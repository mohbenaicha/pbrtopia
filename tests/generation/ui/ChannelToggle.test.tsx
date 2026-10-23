// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ChannelToggle } from '../../../src/generation/ui/ChannelToggle';

afterEach(cleanup);

describe('ChannelToggle (R3)', () => {
  it('R3 Albedo is the chosen channel and the other three are shown but cannot be chosen', () => {
    render(<ChannelToggle />);
    expect(screen.getByRole('radiogroup', { name: 'Channel' })).toBeTruthy();
    expect((screen.getByRole('radio', { name: 'Albedo' })).getAttribute('aria-checked')).toBe('true');
    for (const name of ['Normal', 'Roughness', 'Metalness']) {
      const option = screen.getByRole('radio', { name }) as HTMLButtonElement;
      expect(option.disabled).toBe(true);
      expect(option.getAttribute('aria-checked')).toBe('false');
    }
  });

  it('R3 pressing a disabled channel or an arrow key leaves Albedo chosen', async () => {
    const user = userEvent.setup();
    render(<ChannelToggle />);
    await user.click(screen.getByRole('radio', { name: 'Normal' }));
    screen.getByRole('radio', { name: 'Albedo' }).focus();
    await user.keyboard('{ArrowRight}{End}');
    expect(screen.getByRole('radio', { name: 'Albedo' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Metalness' }).getAttribute('aria-checked')).toBe('false');
  });
});
