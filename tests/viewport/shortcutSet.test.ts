import { describe, expect, it } from 'vitest';
import { ORBIT_SHORTCUTS } from '../../src/viewport/shortcutSet';

describe('app/shortcuts the orbit set', () => {
  it('R2 R5 it names the three camera gestures of viewport-layout R16', () => {
    expect(ORBIT_SHORTCUTS.entries).toEqual([
      { keys: 'Right-drag', action: 'Orbit' },
      { keys: 'Middle-drag', action: 'Pan' },
      { keys: 'Scroll', action: 'Zoom' },
    ]);
  });
});
