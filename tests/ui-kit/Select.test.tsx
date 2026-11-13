// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Select } from '../../src/ui-kit';

afterEach(cleanup);

const models = [
  { value: 'gemini-3-flash', label: 'gemini-3-flash' },
  { value: 'gpt-5-mini', label: 'gpt-5-mini' },
  { value: 'other', label: 'other' },
];

describe('Select', () => {
  it('R22 it shows the selected label on a closed combobox with a listbox that is not rendered', () => {
    render(<Select label="Prompt enhancer model" options={models} value="gpt-5-mini" onChange={() => undefined} />);
    const box = screen.getByRole('combobox', { name: 'Prompt enhancer model' });
    expect(box.textContent).toContain('gpt-5-mini');
    expect(box.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('R22 clicking opens the list, choosing an option reports it and closes the list', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Select label="Prompt enhancer model" options={models} value="gemini-3-flash" onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: 'Prompt enhancer model' }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'gemini-3-flash' }).getAttribute('aria-selected')).toBe('true');
    await user.click(screen.getByRole('option', { name: 'gpt-5-mini' }));
    expect(onChange).toHaveBeenCalledWith('gpt-5-mini');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('R22 a list that opens is scrolled into view (nearest), so inside a scrolling area it is not left hidden past the edge', async () => {
    const scrolled = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element, arg?: boolean | ScrollIntoViewOptions) { scrolled(this.className, arg); };
    try {
      const user = userEvent.setup();
      render(<Select label="Prompt enhancer model" options={models} value="gemini-3-flash" onChange={() => undefined} />);
      expect(scrolled).not.toHaveBeenCalled();
      await user.click(screen.getByRole('combobox', { name: 'Prompt enhancer model' }));
      expect(scrolled).toHaveBeenCalledTimes(1);
      expect(scrolled).toHaveBeenCalledWith('ui-select__list', { block: 'nearest' });
      cleanup();
      scrolled.mockClear();
      render(<Select label="Material" options={models} value="gemini-3-flash" onChange={() => undefined} searchable />);
      await user.click(screen.getByRole('combobox', { name: 'Material' }));
      expect(scrolled).toHaveBeenCalledWith('ui-select__popup', { block: 'nearest' }); // the filter box and the list move together
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('R22 options with a group are listed under a heading for the group, one heading per run of the same group, and headings are not options', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const grouped = [
      { value: 'a', label: 'Default', group: 'Presets' },
      { value: 'b', label: '2-2-2', group: 'Presets' },
      { value: 'c', label: 'Orc head', group: 'Saved setups' },
    ];
    render(<Select label="Layout preset" options={grouped} value="a" onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: 'Layout preset' }));
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getAllByText(/^(Presets|Saved setups)$/).map((heading) => heading.textContent)).toEqual(['Presets', 'Saved setups']);
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('R22 an option with separatorBefore has a divider line above it, which is not an option', async () => {
    const user = userEvent.setup();
    render(<Select label="Model" options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B', separatorBefore: true }]} value="a" onChange={vi.fn()} />);
    await user.click(screen.getByRole('combobox', { name: 'Model' }));
    expect(screen.getAllByRole('separator')).toHaveLength(1);
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('R22 a disabled option is shown, aria-disabled, ignores a click, and the arrow keys skip it', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Select label="Model" options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }, { value: 'c', label: 'C' }]} value="a" onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: 'Model' }));
    expect(screen.getByRole('option', { name: 'B' }).getAttribute('aria-disabled')).toBe('true');
    await user.click(screen.getByRole('option', { name: 'B' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeTruthy(); // still open: the click did nothing
    screen.getByRole('combobox', { name: 'Model' }).focus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('R22 keyboard: ArrowDown opens, arrows move, Enter chooses, Escape closes without choosing', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Select label="Prompt enhancer model" options={models} value="gemini-3-flash" onChange={onChange} />);
    screen.getByRole('combobox', { name: 'Prompt enhancer model' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeTruthy();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('other');
    await user.keyboard('{ArrowDown}{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('R22 clicking outside closes the list', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">elsewhere</button>
        <Select label="Prompt enhancer model" options={models} value="gemini-3-flash" onChange={() => undefined} />
      </>,
    );
    await user.click(screen.getByRole('combobox', { name: 'Prompt enhancer model' }));
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('R22 with no options it is disabled and says so, never a blank box', () => {
    render(<Select label="Model" options={[]} value="" onChange={() => undefined} emptyText="No models found" />);
    const box = screen.getByRole('combobox', { name: 'Model' }) as HTMLButtonElement;
    expect(box.textContent).toContain('No models found');
    expect(box.disabled).toBe(true);
  });

  it('R22 a disabled select does not open', async () => {
    const user = userEvent.setup();
    render(<Select label="Model" options={models} value="other" onChange={() => undefined} disabled />);
    await user.click(screen.getByRole('combobox', { name: 'Model' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  describe('searchable (masks R37)', () => {
    const materials = [
      { value: 'Brick', label: 'Brick', detail: '0.80 / 0.00', group: 'Suggested' },
      { value: 'Steel', label: 'Steel', detail: '0.30 / 1.00', group: 'All materials' },
      { value: 'Stone', label: 'Stone', detail: '0.90 / 0.00', group: 'All materials' },
    ];
    const open = async (onChange = vi.fn()) => {
      const user = userEvent.setup();
      render(<Select label="Material" options={materials} value="Brick" onChange={onChange} searchable noMatchText="No material matches" title="Estimated default" />);
      await user.click(screen.getByRole('combobox', { name: 'Material' }));
      return { user, onChange };
    };

    it('R37 opening puts the cursor in a filter box, and the options show their detail', async () => {
      await open();
      expect(document.activeElement).toBe(screen.getByRole('searchbox'));
      expect(screen.getByRole('option', { name: /Steel/ }).textContent).toContain('0.30 / 1.00');
      expect(screen.getByRole('combobox', { name: 'Material' }).getAttribute('title')).toBe('Estimated default');
    });

    it('R37 typing filters by a case-insensitive part of the name, and the headings follow the options that are left', async () => {
      const { user } = await open();
      await user.keyboard('ST');
      expect(screen.getAllByRole('option').map((option) => option.textContent?.split(/\d/)[0]?.trim())).toEqual(['Steel', 'Stone']);
      expect(screen.queryByText('Suggested')).toBeNull();
    });

    it('R37 a filter that matches nothing says so and offers nothing to choose', async () => {
      const { user } = await open();
      await user.keyboard('zzz');
      expect(screen.queryAllByRole('option')).toHaveLength(0);
      expect(screen.getByText('No material matches')).toBeTruthy();
    });

    it('R37 the arrow keys and Enter choose from the filtered list, and Escape closes it without choosing', async () => {
      const { user, onChange } = await open();
      await user.keyboard('st{ArrowDown}{Enter}');
      expect(onChange).toHaveBeenCalledWith('Stone');
      expect(screen.queryByRole('listbox')).toBeNull();
      await user.click(screen.getByRole('combobox', { name: 'Material' }));
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('R37 the filter starts empty each time the list opens', async () => {
      const { user } = await open();
      await user.keyboard('zzz{Escape}');
      await user.click(screen.getByRole('combobox', { name: 'Material' }));
      expect(screen.getAllByRole('option')).toHaveLength(3);
      expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
    });
  });

  it('R22 an error message is tied to the select', () => {
    render(<Select label="Model" options={models} value="other" onChange={() => undefined} error="Pick a model" />);
    const box = screen.getByRole('combobox', { name: 'Model' });
    expect(box.getAttribute('aria-invalid')).toBe('true');
    const message = screen.getByText('Pick a model');
    expect(box.getAttribute('aria-describedby')).toBe(message.id);
  });
});
