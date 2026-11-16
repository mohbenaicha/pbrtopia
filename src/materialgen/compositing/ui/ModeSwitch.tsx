import { Toggle } from '@shared/ui-kit';
import { CLONE_REASONS } from './cloneReasons';
import type { PaintTool } from './paintTool';
import { PaintTip } from './PaintTip';

interface ModeSwitchProps {
  tool: PaintTool;
  onChange: (tool: PaintTool) => void;
  /** A copy floats: the switch is disabled with the reason (clone R1). */
  locked: boolean;
}

/** Clone R1, R26: the Stamp / Clone choice, one "Mode (Stamp)" / "Mode (Clone)" pill toggle at the top of the Paint panel (off = Stamp, on = Clone), with a rule under it. */
export function ModeSwitch({ tool, onChange, locked }: ModeSwitchProps): React.JSX.Element {
  return (
    <>
      <PaintTip tip="tool">
        <Toggle dense label={`Mode (${tool === 'clone' ? 'Clone' : 'Stamp'})`} checked={tool === 'clone'} disabled={locked} hint={locked ? CLONE_REASONS.floating : undefined} onChange={(on) => onChange(on ? 'clone' : 'stamp')} />
      </PaintTip>
      <hr className="mode-switch__rule" />
    </>
  );
}
