// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button, Checkbox, Dialog, Disclosure, SegmentedControl, Select, Slider, TextInput, Toggle } from '../../src/ui-kit';
import { SettingsSection } from '../../src/viewport/ui/SettingsSection';
import { openTooltipTextOf } from '../support/tooltipDescription';

afterEach(cleanup);

const noop = (): void => undefined;
const OPTIONS = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }];

/** Every kit control and label, drawn once, with how to reach the element that carries its tooltip and the words it must show (app tooltips R1, R3). */
const CASES: ReadonlyArray<{ name: string; draw: () => React.JSX.Element; target: () => HTMLElement; words: string }> = [
  { name: 'Button with a title', draw: () => <Button title="Keeps your changes." onClick={noop}>Save</Button>, target: () => screen.getByRole('button', { name: 'Save' }), words: 'Save. Keeps your changes.' },
  { name: 'Toggle label', draw: () => <Toggle label="Wireframe" hint="Draws the edges." checked={false} onChange={noop} />, target: () => screen.getByText('Wireframe'), words: 'Wireframe. Draws the edges.' },
  { name: 'Toggle without a hint', draw: () => <Toggle label="Wireframe" checked={false} onChange={noop} />, target: () => screen.getByText('Wireframe'), words: 'Wireframe' },
  { name: 'Checkbox', draw: () => <Checkbox label="Select all" hint="Ticks every project." checked={false} onChange={noop} />, target: () => screen.getByText('Select all'), words: 'Select all. Ticks every project.' },
  { name: 'TextInput label', draw: () => <TextInput label="Name" tip="What it is called." value="" onChange={noop} />, target: () => screen.getByText('Name'), words: 'Name. What it is called.' },
  { name: 'Slider label', draw: () => <Slider label="Size" hint="The brush diameter." value={1} min={0} max={2} onChange={noop} />, target: () => screen.getByText('Size'), words: 'Size. The brush diameter.' },
  { name: 'Select label', draw: () => <Select label="Quality" title="How much effort it spends." options={OPTIONS} value="a" onChange={noop} />, target: () => screen.getByText('Quality'), words: 'Quality. How much effort it spends.' },
  { name: 'Segment', draw: () => <SegmentedControl label="Mode" options={[{ value: 'a', label: 'Alpha', hint: 'Does the first thing.' }, { value: 'b', label: 'Beta' }]} value="a" onChange={noop} />, target: () => screen.getByRole('radio', { name: 'Alpha' }), words: 'Alpha. Does the first thing.' },
  { name: 'Segment without a hint', draw: () => <SegmentedControl label="Mode" options={OPTIONS} value="a" onChange={noop} />, target: () => screen.getByRole('radio', { name: 'Beta' }), words: 'Beta' },
  { name: 'Segmented group', draw: () => <SegmentedControl label="Mode" hint="Picks how it works." options={OPTIONS} value="a" onChange={noop} />, target: () => screen.getByRole('radiogroup', { name: 'Mode' }), words: 'Mode. Picks how it works.' },
  { name: 'Disclosure title', draw: () => <Disclosure title="Advanced" open={false} onOpenChange={noop}>body</Disclosure>, target: () => screen.getByText('Advanced'), words: 'Advanced. Click to show this section.' },
  { name: 'Disclosure title with a hint', draw: () => <Disclosure title="Advanced" hint="Rarely needed options." open onOpenChange={noop}>body</Disclosure>, target: () => screen.getByText('Advanced'), words: 'Advanced. Rarely needed options.' },
  { name: 'Dialog title', draw: () => <Dialog open title="Rename" onClose={noop}>body</Dialog>, target: () => screen.getByRole('heading', { name: 'Rename' }), words: 'Rename' },
  { name: 'Settings section heading', draw: () => <SettingsSection title="Light" hint="How bright it is.">body</SettingsSection>, target: () => screen.getByRole('heading', { name: 'Light' }), words: 'Light. How bright it is.' },
];

describe('app tooltips R1 R3 the kit carries a tooltip on every control and label', () => {
  for (const { name, draw, target, words } of CASES) {
    it(`app tooltips R1 R3 ${name}: the tooltip shows ${JSON.stringify(words)} with no call-site wiring`, () => {
      render(draw());
      expect(openTooltipTextOf(target())).toBe(words);
    });
  }
});

describe('app tooltips R4 a disabled control still shows its tooltip and says why', () => {
  it('app tooltips R4 a disabled Button shows its reason from its wrapper', () => {
    render(<Button disabled title="Add a key first." onClick={noop}>Generate</Button>);
    const wrapper = screen.getByRole('button', { name: 'Generate' }).closest('.ui-button__tip') as HTMLElement;
    expect(openTooltipTextOf(wrapper)).toBe('Generate. Add a key first.');
  });

  it('app tooltips R4 a disabled Toggle shows its reason from its row', () => {
    render(<Toggle label="Background" hint="The studio has no backdrop." disabled checked={false} onChange={noop} />);
    expect(openTooltipTextOf(screen.getByText('Background'))).toBe('Background. The studio has no backdrop.');
  });
});

// Known gap, flagged on purpose: `Button` draws a tooltip only when a call site gives it a `title`; 88 of the 96 `<Button>` call sites (Cancel, Retry, Save, ...) give none.
it.todo('app tooltips R1 a Button without a title has a tooltip too, its label as the heading');

describe('app tooltips R2 no control sets a native title', () => {
  it('app tooltips R2 no element drawn by the kit controls carries a title attribute', () => {
    for (const { draw } of CASES) {
      const { container, unmount } = render(draw());
      expect(document.body.querySelectorAll('[title]').length, container.innerHTML).toBe(0);
      unmount();
    }
  });
});
