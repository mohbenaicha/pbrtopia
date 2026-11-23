// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { card, planOf, setupOverlay, SUNBURST } from './setupHarness';

beforeEach(() => {
  let count = 0;
  URL.createObjectURL = vi.fn(() => `blob:fake/${++count}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const AUX = 'Auxiliary image';
const previewButton = (): HTMLElement => within(card(AUX)).getByRole('button', { name: 'Preview atlas' });
const done = { ok: true as const, value: new Blob(['aux'], { type: 'image/png' }) };

describe('the aux card Preview atlas button (custom R51)', () => {
  it('custom R51 sits in the aux card while the aux sheet is included', () => {
    setupOverlay({ onPreviewAux: vi.fn(async () => done) });
    expect(previewButton()).toBeTruthy();
  });

  it('custom R51 is not there when the aux sheet is off', () => {
    setupOverlay({ activePlan: planOf([[0]], null), onPreviewAux: vi.fn(async () => done) });
    expect(within(card(AUX)).queryByRole('button', { name: 'Preview atlas' })).toBeNull();
  });

  it('custom R51 is not there when the host gives no preview', () => {
    setupOverlay();
    expect(within(card(AUX)).queryByRole('button', { name: 'Preview atlas' })).toBeNull();
  });

  it('custom R51 is disabled until the aux canvas is known', () => {
    setupOverlay({ onPreviewAux: vi.fn(async () => done), previewsOf: (plan) => [...plan.sheets.map(() => null), null] });
    expect((previewButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('custom R51 a click asks the host for the plan as it stands, shows busy, then opens the picture in the viewer', async () => {
    let finish: (value: typeof done) => void = () => undefined;
    const onPreviewAux = vi.fn(() => new Promise<typeof done>((resolve) => { finish = resolve; }));
    setupOverlay({ activePlan: planOf([[0], [1]], SUNBURST), onPreviewAux });
    fireEvent.click(previewButton());
    expect(onPreviewAux).toHaveBeenCalledWith(planOf([[0], [1]], SUNBURST));
    await waitFor(() => expect(previewButton().getAttribute('aria-busy')).toBe('true'));
    await act(async () => finish(done));
    expect(await screen.findByRole('dialog', { name: 'Atlas preview' })).toBeTruthy();
    expect(previewButton().getAttribute('aria-busy')).not.toBe('true');
  });

  it('custom R51 a failure shows its message under the button and opens no viewer', async () => {
    setupOverlay({ onPreviewAux: vi.fn(async () => ({ ok: false as const, error: 'GPU lost' })) });
    fireEvent.click(previewButton());
    expect(await within(card(AUX)).findByText('GPU lost')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Atlas preview' })).toBeNull();
  });

  it('custom R51 the viewer is drawn on a layer above the overlay', async () => {
    setupOverlay({ onPreviewAux: vi.fn(async () => done) });
    fireEvent.click(previewButton());
    const dialog = await screen.findByRole('dialog', { name: 'Atlas preview' });
    expect(dialog.closest('.ui-dialog__backdrop')?.parentElement).toBe(document.body); // a portal into the body, so the overlay cannot paint over it
  });

  it('custom R51 Escape with the viewer open closes only the viewer', async () => {
    const { props } = setupOverlay({ onPreviewAux: vi.fn(async () => done) });
    fireEvent.click(previewButton());
    await screen.findByRole('dialog', { name: 'Atlas preview' });
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Atlas preview' })).toBeNull());
    expect(props.onCancel).not.toHaveBeenCalled();
  });
});
