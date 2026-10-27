// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunStep } from '../../../src/generation/generateStore';
import { ProgressSteps } from '../../../src/generation/ui/ProgressSteps';

afterEach(cleanup);

function setup(step: RunStep, fraction = 0, failed = false) {
  const onCancel = vi.fn();
  render(<ProgressSteps step={step} fraction={fraction} failed={failed} onCancel={onCancel} />);
  const items = within(screen.getByRole('list', { name: 'Progress' })).getAllByRole('listitem');
  return { onCancel, items, states: items.map((item) => item.getAttribute('data-state')) };
}

describe('ProgressSteps (R10)', () => {
  it('R10 lists Capturing views, Enhancing prompt, Generating image and Validating in that order', () => {
    const { items } = setup('capture');
    expect(items.map((item) => item.textContent)).toEqual(['Capturing views', 'Enhancing prompt', 'Generating image', 'Validating']);
  });

  it('R10 finished steps are done, the current one is active and later ones are pending', () => {
    expect(setup('capture').states).toEqual(['active', 'pending', 'pending', 'pending']);
    cleanup();
    expect(setup('enhance').states).toEqual(['done', 'active', 'pending', 'pending']);
    cleanup();
    expect(setup('generate').states).toEqual(['done', 'done', 'active', 'pending']);
    cleanup();
    expect(setup('validate').states).toEqual(['done', 'done', 'done', 'active']);
  });

  it('R10 only the current step has a progress bar, with its fraction as a percentage', () => {
    setup('generate', 0.4);
    const bars = screen.getAllByRole('progressbar');
    expect(bars).toHaveLength(1);
    expect(bars[0]?.getAttribute('aria-valuenow')).toBe('40');
    expect(bars[0]?.getAttribute('aria-label')).toBe('Generating image');
  });

  it('R10 a fraction of 0 is shown as an indeterminate bar', () => {
    setup('enhance', 0);
    expect(screen.getByRole('progressbar').hasAttribute('aria-valuenow')).toBe(false);
  });

  it('R10 a fraction outside 0-1 is limited', () => {
    setup('generate', 7);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('R9 after a failure the failed step is marked failed and has no progress bar', () => {
    const { states } = setup('generate', 0.3, true);
    expect(states).toEqual(['done', 'done', 'failed', 'pending']);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('R10 Cancel calls onCancel', () => {
    const { onCancel } = setup('enhance');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('R10 once the image request is sent the Cancel button says the provider may still bill it', () => {
    setup('generate');
    expect(screen.getByRole('button', { name: 'Cancel (may still be billed)' })).toBeTruthy();
  });

  it('R10 before and after the image step the Cancel button makes no billing claim', () => {
    for (const step of ['capture', 'enhance', 'validate'] as const) {
      cleanup();
      setup(step);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    }
  });

  it('R9 there is no Cancel button once the run has failed', () => {
    setup('generate', 0, true);
    expect(screen.queryByRole('button', { name: /Cancel/ })).toBeNull();
  });
});

describe('ProgressSteps: the link to the log row (R27)', () => {
  const link = () => screen.queryByRole('button', { name: 'View log' });
  const itemsWithLink = () => screen.getAllByRole('listitem').filter((item) => within(item).queryByRole('button', { name: 'View log' }) !== null).map((item) => item.textContent);

  function setupWithLink(step: RunStep, failed = false) {
    const onViewLog = vi.fn();
    render(<ProgressSteps step={step} fraction={0} failed={failed} onCancel={vi.fn()} onViewLog={onViewLog} />);
    return { onViewLog };
  }

  it('R27 there is no link until the Enhancing prompt step is done', () => {
    setupWithLink('capture');
    expect(link()).toBeNull();
    cleanup();
    setupWithLink('enhance');
    expect(link()).toBeNull();
  });

  it('R27 once Enhancing prompt is done its item, and only that item, shows View log', () => {
    for (const step of ['generate', 'validate'] as const) {
      cleanup();
      setupWithLink(step);
      expect(itemsWithLink()).toEqual(['Enhancing promptView log']);
    }
  });

  it('R27 clicking the link reports it', () => {
    const { onViewLog } = setupWithLink('generate');
    fireEvent.click(screen.getByRole('button', { name: 'View log' }));
    expect(onViewLog).toHaveBeenCalledTimes(1);
  });

  it('R27 after a failure the failed step shows the link as well', () => {
    setupWithLink('generate', true);
    expect(itemsWithLink()).toEqual(['Enhancing promptView log', 'Generating imageView log']);
  });

  it('R27 a failure in the Enhancing prompt step shows one link, on that item', () => {
    setupWithLink('enhance', true);
    expect(itemsWithLink()).toEqual(['Enhancing promptView log']);
  });

  it('R27 without a log row to point at there is no link', () => {
    setup('generate');
    expect(link()).toBeNull();
  });
});
