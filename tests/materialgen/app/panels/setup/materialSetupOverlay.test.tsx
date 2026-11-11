// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GenerationPanel, GenerationPlan } from '@mat/generation';
import { MaterialSetupOverlay } from '@mat/app/panels/setup/MaterialSetupOverlay';
import { makeGenerationPanel } from '../generate/fakeGeneration';

afterEach(cleanup);

function open(generation: GenerationPanel = makeGenerationPanel(), colorMode: 'albedo' | 'diffuse' = 'albedo') {
  const onClose = vi.fn();
  render(<MaterialSetupOverlay generation={generation} colorMode={colorMode} onClose={onClose} />);
  return { generation, onClose };
}

const card = (name: string): HTMLElement => screen.getByRole('group', { name });
const chip = (name: string): HTMLElement => within(screen.getByRole('group', { name: 'Maps' })).getByRole('button', { name });
const confirm = (): HTMLButtonElement => screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement;
const confirmedPlan = (generation: GenerationPanel): GenerationPlan => (generation.choice.replacePlan as ReturnType<typeof vi.fn>).mock.calls[0]![0] as GenerationPlan;
const mapsOf = (name: string): string[] =>
  within(card(name))
    .queryAllByRole('button', { name: /^Remove .* from / })
    .map((button) => (button.getAttribute('aria-label') ?? '').replace(/^Remove (.*) from .*$/, '$1'));

describe('materialgen/generation setup overlay', () => {
  it('R10 from the top: the chip row, the toolbar (Layout preset, Sync settings, Save setup), the image cards, then Cancel and Confirm', () => {
    open();
    const order = [
      screen.getByRole('group', { name: 'Maps' }),
      screen.getByRole('combobox', { name: 'Layout preset' }),
      screen.getByRole('switch', { name: 'Sync settings' }),
      screen.getByRole('button', { name: 'Save setup' }),
      card('Image 1'),
      screen.getByRole('button', { name: 'Cancel' }),
      confirm(),
    ];
    for (let i = 1; i < order.length; i += 1) expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING, `part ${i}`).toBeTruthy();
    expect(['Albedo', 'Normal', 'Height', 'Metal-Roughness'].map((name) => chip(name).getAttribute('aria-label'))).toEqual(['Albedo', 'Normal', 'Height', 'Metal-Roughness']);
    expect(screen.getByRole('switch', { name: 'Sync settings' }).getAttribute('aria-checked')).toBe('false'); // R17: off at first
  });

  it('R11 the chip row shows each map once; Albedo sits on Image 1 and has no remove button, the others do', () => {
    open();
    expect(mapsOf('Image 1')).toEqual([]);
    expect(within(card('Image 1')).getAllByText('Albedo')).toHaveLength(2); // its chip and its tile in the preview
    expect(within(card('Image 1')).queryByRole('button', { name: /Remove Albedo/ })).toBeNull();
    expect(within(card('Image 2')).getByRole('button', { name: 'Remove Normal from image 2' })).toBeTruthy();
    expect(within(card('Image 3')).getByRole('button', { name: 'Remove Height from image 3' })).toBeTruthy();
    expect(chip('Albedo').closest('figure')!.getAttribute('data-assigned')).toBe('true');
  });

  it('R11 the keyboard path: pick Normal up, press "Add Normal to image 1"; Image 1 then holds both and is announced', () => {
    open();
    fireEvent.click(chip('Normal'));
    expect(chip('Normal').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(card('Image 1')).getByRole('button', { name: 'Add Normal to image 1' }));
    expect(mapsOf('Image 1')).toEqual(['Normal']);
    expect(mapsOf('Image 2')).toEqual([]);
    expect(screen.getByTestId('setup-announcement').textContent).toBe('Normal added to image 1.');
  });

  it('R11 Albedo cannot be taken off Image 1: picking it offers no Unassign', () => {
    open();
    fireEvent.click(chip('Albedo'));
    expect(screen.queryByRole('button', { name: 'Unassign Albedo' })).toBeNull();
  });

  it('R11 an assigned map goes back to the row with Unassign', () => {
    open();
    fireEvent.click(chip('Normal'));
    fireEvent.click(screen.getByRole('button', { name: 'Unassign Normal' }));
    expect(mapsOf('Image 2')).toEqual([]);
    expect(chip('Normal').closest('figure')!.getAttribute('data-assigned')).toBe('false');
  });

  it('R12 the Metal-Roughness chip is not draggable and its tooltip points to the checkbox of its card', () => {
    open();
    const metal = chip('Metal-Roughness');
    expect(metal.getAttribute('draggable')).not.toBe('true');
    expect(metal.getAttribute('aria-disabled')).toBe('true');
    expect(metal.getAttribute('title')).toMatch(/Include box of the Metal-Roughness card/);
    fireEvent.click(metal);
    expect(screen.queryByRole('button', { name: /Add Metal-Roughness/ })).toBeNull();
  });

  it('R13 Image 1 cannot be removed; another image can, and its maps become unassigned', () => {
    open();
    expect(within(card('Image 1')).queryByRole('button', { name: 'Remove image 1' })).toBeNull();
    fireEvent.click(within(card('Image 2')).getByRole('button', { name: 'Remove image 2' }));
    expect(screen.queryByRole('group', { name: 'Image 3' })).toBeNull(); // the old Image 3 is Image 2 now
    expect(mapsOf('Image 2')).toEqual(['Height']);
    expect(chip('Normal').closest('figure')!.getAttribute('data-assigned')).toBe('false');
  });

  it('R13 "+ add image" adds an empty card that says "Drop a map here" and is hidden at three images', () => {
    open();
    expect(screen.queryByRole('button', { name: 'Add another image' })).toBeNull(); // the preset already has three
    fireEvent.click(within(card('Image 3')).getByRole('button', { name: 'Remove image 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add another image' }));
    expect(within(card('Image 3')).getByText('Drop a map here')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add another image' })).toBeNull();
  });

  it('R14 a card with maps shows its canvas, the tiles named, and the caption; two maps or more show the alignment caveat', () => {
    open();
    fireEvent.click(chip('Normal'));
    fireEvent.click(within(card('Image 1')).getByRole('button', { name: 'Add Normal to image 1' }));
    const preview = within(card('Image 1')).getByTestId('sheet-preview');
    expect(within(preview).getByText('Albedo')).toBeTruthy();
    expect(within(preview).getByText('Normal')).toBeTruthy();
    expect(within(card('Image 1')).getByText(/^Canvas \d+ x \d+ - tiles \d+ px - [12]x[12]$/)).toBeTruthy();
    expect(within(card('Image 1')).getByText('Maps from one image may not line up exactly')).toBeTruthy();
    expect(within(card('Image 2')).queryByText('Maps from one image may not line up exactly')).toBeNull();
    expect(within(card('Image 2')).getByText('Drop a map here')).toBeTruthy();
  });

  it('R14 a lone map shows a 1x1 caption without the caveat', () => {
    open();
    expect(within(card('Image 1')).getByText(/- 1x1$/)).toBeTruthy();
    expect(within(card('Image 1')).queryByText(/line up/)).toBeNull();
  });

  it('R15 the Metal-Roughness card is ticked at first, has its own fields and a 1x1 preview; unticking removes its fields and the plan drops it on Confirm', () => {
    const { generation } = open();
    const metal = card('Metal-Roughness');
    expect(within(metal).getByRole('checkbox', { name: 'Include' }).matches(':checked')).toBe(true);
    expect(within(metal).getByRole('combobox', { name: 'Metal-Roughness model' })).toBeTruthy();
    expect(within(metal).getByText(/- 1x1$/)).toBeTruthy();
    expect(within(metal).getByText('Segmentation image used to derive roughness and metal.')).toBeTruthy();
    fireEvent.click(within(metal).getByRole('checkbox', { name: 'Include' }));
    expect(within(card('Metal-Roughness')).queryByRole('combobox', { name: 'Metal-Roughness model' })).toBeNull();
    fireEvent.click(confirm());
    expect(confirmedPlan(generation).decomposition).toBeNull();
  });

  it('R15 a card never lists "decomposition" in a label', () => {
    open();
    expect(document.body.textContent).not.toMatch(/decomposition/i);
  });

  it('R18 Confirm hands the edited plan over and closes; the project plan is untouched before it', () => {
    const { generation, onClose } = open();
    fireEvent.click(chip('Normal'));
    fireEvent.click(within(card('Image 1')).getByRole('button', { name: 'Add Normal to image 1' }));
    expect(generation.choice.replacePlan).not.toHaveBeenCalled();
    fireEvent.click(confirm());
    expect(confirmedPlan(generation).images[0]!.maps).toEqual(['albedo', 'normal']);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('R18 Cancel and Escape drop the edits and close; a press outside does nothing', () => {
    const first = open();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(first.onClose).toHaveBeenCalledTimes(1);
    expect(first.generation.choice.replacePlan).not.toHaveBeenCalled();
    cleanup();
    const second = open();
    fireEvent.pointerDown(screen.getByTestId('setup-backdrop'));
    fireEvent.mouseDown(screen.getByTestId('setup-backdrop'));
    expect(second.onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(second.onClose).toHaveBeenCalledTimes(1);
  });

  it('R18 Confirm is off, with the reason as its tooltip, when a model has no key', () => {
    open(makeGenerationPanel({ keyed: [] }));
    expect(confirm().disabled).toBe(true);
    expect(confirm().title).toMatch(/key/i);
  });

  it('R20 Save setup asks for a name and stores the draft under it', () => {
    const { generation } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Brick pair' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    expect(generation.choice.saveSetup).toHaveBeenCalledWith('Brick pair', generation.choice.plan);
  });

  it('R20 a saved setup appears under Saved setups and choosing it loads it into the draft', () => {
    const generation = makeGenerationPanel();
    const loaded: GenerationPlan = { ...generation.choice.plan, images: [{ ...generation.choice.plan.images[0]!, maps: ['albedo', 'normal', 'height'] }] };
    generation.choice.saved = [{ name: 'All in one', plan: loaded }];
    open(generation);
    fireEvent.click(screen.getByRole('combobox', { name: 'Layout preset' }));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'All in one' }));
    expect(mapsOf('Image 1')).toEqual(['Normal', 'Height']);
    expect(screen.getByRole('button', { name: 'Delete setup' })).toBeTruthy();
  });

  it('R11 a chip on an image says which one holds it; one that is on none says nothing', () => {
    open();
    const row = within(screen.getByRole('group', { name: 'Maps' }));
    expect(['Image 1', 'Image 2', 'Image 3'].map((text) => row.getAllByText(text).length)).toEqual([1, 1, 1]); // preset 1: one map per image
    fireEvent.click(chip('Normal'));
    fireEvent.click(screen.getByRole('button', { name: 'Unassign Normal' }));
    expect(row.queryAllByText('Image 2')).toHaveLength(0);
    expect(row.getAllByText('Image 1')).toHaveLength(1);
  });

  it('R17 the Sync settings switch turns on from the overlay', () => {
    open();
    fireEvent.click(screen.getByRole('switch', { name: 'Sync settings' }));
    expect(screen.getByRole('switch', { name: 'Sync settings' }).getAttribute('aria-checked')).toBe('true');
  });

  it('R18 Confirm is off, with the reason as its tooltip, when the describe step has no model', () => {
    open(makeGenerationPanel({ describeProvider: null }));
    expect(confirm().disabled).toBe(true);
    expect(confirm().title).toBe('Choose a prompt enhancer model in Settings.');
  });

  it('R19 a plan that names a model the catalog does not list keeps its settings, shows the card as unavailable and keeps Confirm off', () => {
    const generation = makeGenerationPanel();
    const image = generation.choice.plan.images[0]!;
    generation.choice.plan = { ...generation.choice.plan, images: [{ ...image, settings: { ...image.settings, modelId: 'retired-model' } }, ...generation.choice.plan.images.slice(1)] };
    open(generation);
    expect(confirm().disabled).toBe(true);
    expect(confirm().title).toMatch(/no longer available|not available/i);
    expect(within(card('Image 1')).getByRole('alert').textContent).toMatch(/no longer available|not available/i);
  });

  it('R20 with a saved setup chosen, Delete setup deletes it by name', () => {
    const generation = makeGenerationPanel();
    const loaded: GenerationPlan = { ...generation.choice.plan, images: [{ ...generation.choice.plan.images[0]!, maps: ['albedo', 'normal', 'height'] }] };
    generation.choice.plan = loaded;
    generation.choice.saved = [{ name: 'Mine', plan: loaded }];
    open(generation);
    fireEvent.click(screen.getByRole('button', { name: 'Delete setup' }));
    expect(generation.choice.deleteSetup).toHaveBeenCalledWith('Mine');
  });

  it('R20 a name already used asks before it replaces that setup', () => {
    const generation = makeGenerationPanel();
    generation.choice.saved = [{ name: 'Mine', plan: { ...generation.choice.plan, decomposition: null } }];
    open(generation);
    fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Mine' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    expect(generation.choice.saveSetup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(generation.choice.saveSetup).toHaveBeenCalledWith('Mine', generation.choice.plan);
  });

  it('R10 Diffuse mode names the first chip Diffuse', () => {
    open(makeGenerationPanel(), 'diffuse');
    expect(chip('Diffuse')).toBeTruthy();
    expect(within(card('Image 1')).getAllByText('Diffuse').length).toBeGreaterThan(0);
  });
});
