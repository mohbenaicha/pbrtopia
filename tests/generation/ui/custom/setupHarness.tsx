import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { KNOWN_MODELS } from '../../../../src/generation/catalog/knownModels';
import type { CustomPlanRecord, NamedPlanRecord, SheetSettings } from '../../../../src/generation';
import { SetupOverlay, type SetupOverlayProps } from '../../../../src/generation/ui/custom/SetupOverlay';

export const SUNBURST: SheetSettings = { provider: 'openai', modelId: 'gpt-image-2.5-sunburst', resolutionKey: '1K', quality: 'low' };
export const NANO: SheetSettings = { provider: 'gemini', modelId: 'gemini-nano-banana-2.1', resolutionKey: '1K', quality: null };
export const planOf = (cameras: number[][], aux: SheetSettings | null = null, settings: SheetSettings = SUNBURST): CustomPlanRecord => ({
  sheets: cameras.map((list) => ({ cameras: list, settings })),
  aux: aux === null ? null : { settings: aux },
});

export const CAMERAS = ['Front', 'Right', 'Back', 'Left', 'Top', 'Bottom'];

export function dataTransfer() {
  return { setData: vi.fn(), getData: vi.fn(() => ''), setDragImage: vi.fn(), effectAllowed: '', dropEffect: '' };
}

// Opens a combobox by its name and picks the option; the Layout preset dropdown is one.
export function chooseOption(select: string, option: RegExp | string): void {
  fireEvent.click(screen.getByRole('combobox', { name: select }));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
}

export function setupOverlay(patch: Partial<SetupOverlayProps> = {}) {
  const props: SetupOverlayProps = {
    activePlan: planOf([[0], [2], [1, 3], [4, 5]], SUNBURST),
    snapshots: CAMERAS.map((name) => new Blob([name], { type: 'image/png' })),
    trims: CAMERAS.map(() => ({ x: 0, y: 0, w: 1, h: 1 })),
    previewsOf: (plan) => [
      ...plan.sheets.map((sheet) => (sheet.cameras.length === 0 ? null : { aspect: 1, tiles: sheet.cameras.map((camera, index) => ({ camera, x: index * 0.2, y: 0, w: 0.2, h: 1 })) })),
      ...(plan.aux === null ? [] : [{ aspect: 1, tiles: [] }]),
    ],
    catalog: { gemini: KNOWN_MODELS.filter((model) => model.provider === 'gemini'), openai: KNOWN_MODELS.filter((model) => model.provider === 'openai') },
    hasKey: { gemini: true, openai: true },
    maxTextureSize: 8192,
    today: '2026-10-19',
    savedSetups: [],
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    onSaveSetup: vi.fn(),
    onDeleteSetup: vi.fn(),
    ...patch,
  };
  const view = render(<SetupOverlay {...props} />);
  return { props, ...view };
}

export const card = (name: string): HTMLElement => screen.getByRole('group', { name });
export const camerasIn = (name: string): string[] =>
  within(card(name))
    .queryAllByRole('button', { name: /^Remove .* from / })
    .map((button) => (button.getAttribute('aria-label') ?? '').replace(/^Remove (.*) from .*$/, '$1'));
export const snapshotButton = (name: string): HTMLElement => within(screen.getByRole('group', { name: 'Snapshots' })).getByRole('button', { name });
export type { NamedPlanRecord };
