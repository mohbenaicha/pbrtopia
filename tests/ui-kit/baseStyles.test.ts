import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The look of the scrollbars and the fit of the segmented control are CSS: these tests read the stylesheet text (the real layout is checked
// in the browser by tests/ui/app.layout.spec.ts).
const base = readFileSync('src/ui-kit/base.css', 'utf8');
const segmented = readFileSync('src/ui-kit/SegmentedControl.css', 'utf8');

describe('base.css scrollbars (viewport-layout R26)', () => {
  it('R26 every element gets a thin scrollbar with a gold thumb and no track colour', () => {
    expect(base).toMatch(/\*\s*\{[^}]*scrollbar-width:\s*thin/);
    expect(base).toMatch(/scrollbar-color:\s*var\(--number\)\s+transparent/);
  });

  it('R26 the webkit scrollbar has a transparent track, no corner and no arrow buttons, and a brighter thumb on hover', () => {
    expect(base).toMatch(/::-webkit-scrollbar-track\s*\{[^}]*background:\s*transparent/);
    expect(base).toMatch(/::-webkit-scrollbar-button\s*\{[^}]*display:\s*none/);
    expect(base).toMatch(/::-webkit-scrollbar-corner\s*\{[^}]*background:\s*transparent/);
    expect(base).toMatch(/::-webkit-scrollbar-thumb:hover/);
  });

  it('R26 no feature stylesheet sets its own scrollbar colours', () => {
    for (const file of ['src/shell/LeftPanel.css', 'src/shell/RightPanel.css', 'src/viewport/ui/ViewportSettingsPanel.css', 'src/ui-kit/Select.css']) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/scrollbar/);
    }
  });
});

describe('SegmentedControl.css fit (viewport-layout R27)', () => {
  it('R27 the control never grows past its container and wraps its options instead of overflowing', () => {
    expect(segmented).toMatch(/\.ui-segmented\s*\{[^}]*max-width:\s*100%/);
    expect(segmented).toMatch(/\.ui-segmented\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(segmented).toMatch(/\.ui-segmented__option\s*\{[^}]*min-width:\s*0/);
  });
});
