// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeChannelAvailability, type ChannelAvailabilityMap, type GenerateChannel } from '../../../src/generation';
import { ChannelToggle } from '../../../src/generation/ui/ChannelToggle';

afterEach(cleanup);

const open = describeChannelAvailability({ hasModel: true, busy: false, setOpen: false, albedoInForce: { kind: 'picture', id: 'a' }, sourceIsSquare: true });
const closed = describeChannelAvailability({ hasModel: true, busy: false, setOpen: false, albedoInForce: { kind: 'none' }, sourceIsSquare: null });

function setup(availability: ChannelAvailabilityMap, value: GenerateChannel = 'albedo') {
  const onChange = vi.fn();
  render(<ChannelToggle value={value} availability={availability} onChange={onChange} />);
  return { onChange };
}

const describedBy = (name: string): string => {
  const radio = screen.getByRole('radio', { name });
  return (radio.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
};

describe('ChannelToggle (normal-map R1, R2)', () => {
  it('normal-map R1 lists Albedo, Normal and Metal-Roughness in that order, with Albedo chosen by default', () => {
    setup(open);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.textContent)).toEqual(['Albedo', 'Normal', 'Metal-Roughness']);
    expect(screen.getByRole('radiogroup', { name: 'Channel' })).toBeTruthy();
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
  });

  it('normal-map R1 the chosen value is the one that is checked', () => {
    setup(open, 'normal');
    expect(screen.getByRole('radio', { name: 'Normal' }).getAttribute('aria-checked')).toBe('true');
  });

  it('normal-map R2 with one generated albedo on every material all three can be chosen, and a click reports the choice', async () => {
    const { onChange } = setup(open);
    for (const radio of screen.getAllByRole('radio')) expect((radio as HTMLButtonElement).disabled).toBe(false);
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Normal' }));
    expect(onChange).toHaveBeenCalledWith('normal');
  });

  it('normal-map R2 without a source albedo Normal and Metal-Roughness are disabled with the reason, and Albedo stays on', async () => {
    const { onChange } = setup(closed);
    expect((screen.getByRole('radio', { name: 'Albedo' }) as HTMLButtonElement).disabled).toBe(false);
    for (const name of ['Normal', 'Metal-Roughness']) {
      expect((screen.getByRole('radio', { name }) as HTMLButtonElement).disabled).toBe(true);
      expect(describedBy(name)).toContain('Bake or apply one albedo to the whole model first.');
    }
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Normal' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('normal-map R2 a task in progress disables Normal and Metal-Roughness with the wait reason', () => {
    setup(describeChannelAvailability({ hasModel: true, busy: true, setOpen: false, albedoInForce: { kind: 'picture', id: 'a' }, sourceIsSquare: true }), 'normal');
    expect((screen.getByRole('radio', { name: 'Normal' }) as HTMLButtonElement).disabled).toBe(true);
    expect(describedBy('Normal')).toContain('Wait for the current task to finish.');
  });

  it('normal-map R2 a picture that is not square disables Normal with its reason', () => {
    setup(describeChannelAvailability({ hasModel: true, busy: false, setOpen: false, albedoInForce: { kind: 'picture', id: 'a' }, sourceIsSquare: false }));
    expect(describedBy('Normal')).toContain('Normal maps need a square albedo picture.');
  });

  it('normal-map R2 an available option explains itself in a sentence', () => {
    setup(open);
    expect(describedBy('Normal')).toContain('relief');
  });
});
