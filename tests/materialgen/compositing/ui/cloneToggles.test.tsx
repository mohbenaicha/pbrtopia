// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CLONE_SETTINGS } from '@mat/compositing/clone/createCloneEngine';
import { CloneControls } from '@mat/compositing/ui/CloneControls';
import type { CloneView } from '@mat/compositing/ui/createCloneMode';
import { ModeSwitch } from '@mat/compositing/ui/ModeSwitch';

afterEach(cleanup);

const view: CloneView = { phase: 'highlight', canClone: false, canConfirm: false, cloneBlocked: 'empty', confirmBlocked: null, scalePercent: null, settings: DEFAULT_CLONE_SETTINGS };

describe('clone R26: pill toggles, not segmented groups', () => {
  it('TestCloneR26_the_tool_choice_is_one_Mode_switch_named_for_the_active_tool_with_a_rule_under_it', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ModeSwitch tool="stamp" locked={false} onChange={onChange} />);
    const toggle = screen.getByRole('switch', { name: 'Mode (Stamp)' }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(document.querySelector('hr.mode-switch__rule')).not.toBeNull();
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith('clone');
    rerender(<ModeSwitch tool="clone" locked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Mode (Clone)' }));
    expect(onChange).toHaveBeenLastCalledWith('stamp');
  });

  it('TestCloneR26_a_floating_copy_disables_the_tool_switch', () => {
    render(<ModeSwitch tool="clone" locked onChange={vi.fn()} />);
    expect((screen.getByRole('switch', { name: 'Mode (Clone)' }) as HTMLInputElement).disabled).toBe(true);
  });

  it('TestCloneR26_the_brush_shape_is_one_Square_switch', () => {
    const onSettings = vi.fn();
    render(<CloneControls view={view} size={0.1} onSize={vi.fn()} onSettings={onSettings} onScale={vi.fn()} onClone={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    const square = screen.getByRole('switch', { name: 'Square' }) as HTMLInputElement;
    expect(square.checked).toBe(false);
    fireEvent.click(square);
    expect(onSettings).toHaveBeenLastCalledWith({ shape: 'square' });
  });
});
