import { Button, Icon, IconButton, Slider } from '../../ui-kit';
import type { DocumentEventName, ToolId } from '../machine/interaction';
import { MAX_BRUSH_SIZE, MIN_BRUSH_SIZE, clampBrushSize, type EditorSettings } from '../stroke/settings';
import type { StageHandle } from './CanvasStage';

export const NEED_SELECTION = 'Select something first.';
export const HISTORY_DROPPED = 'Older steps were dropped.';

export interface ToolbarState { hasSelection: boolean; canUndo: boolean; canRedo: boolean; droppedOlder: boolean }

interface ToolbarProps {
  settings: EditorSettings;
  state: ToolbarState;
  stage: { current: StageHandle | null };
  onSettings: (next: EditorSettings) => void;
  /** Re-reads the document state after a command. */
  onChanged: () => void;
}

const TOOLS: Array<{ id: ToolId; label: string; hint: string; icon: 'brush' | 'select-lasso' | 'select-box' }> = [
  { id: 'paint', label: 'Paint', hint: 'Paints with the colour. Paints only inside the selection, when there is one.', icon: 'brush' },
  { id: 'selectBrush', label: 'Select with brush', hint: 'Adds to the selection by painting over it.', icon: 'select-lasso' },
  { id: 'selectRect', label: 'Select rectangle', hint: 'Adds a rectangle to the selection.', icon: 'select-box' },
];

/** The editor's controls. Every control asks the stage first (`accepts`), so nothing changes while a stroke or a pan is in progress. */
export function Toolbar({ settings, state, stage, onSettings, onChanged }: ToolbarProps): React.JSX.Element {
  const change = (name: DocumentEventName, next: EditorSettings): void => { if (stage.current?.accepts(name) === true) onSettings(next); };
  const run = (command: 'undo' | 'redo' | 'invert' | 'fill' | 'crop'): void => { stage.current?.run(command); onChanged(); };
  const needSelection = state.hasSelection ? undefined : NEED_SELECTION;
  return (
    <div className="reference-editor__toolbar" role="toolbar" aria-label="Picture tools">
      <div className="reference-editor__group" role="group" aria-label="Tool">
        {TOOLS.map((tool) => (
          <IconButton key={tool.id} label={tool.label} hint={tool.hint} icon={<Icon name={tool.icon} />} pressed={settings.tool === tool.id} onClick={() => change('setTool', { ...settings, tool: tool.id })} />
        ))}
      </div>
      <div className="reference-editor__group reference-editor__group--brush" role="group" aria-label="Brush">
        <label className="reference-editor__colour">
          <span>Colour</span>
          <input type="color" aria-label="Colour" value={hexOf(settings.colour)} onChange={(event) => change('setColour', { ...settings, colour: wordOf(event.target.value) })} />
        </label>
        <div className="reference-editor__brush">
          <Slider label="Brush size" hint="The width of the brush, in picture pixels. Keys [ and ] change it; Shift and moving the mouse over the picture changes it too." value={settings.brushSize} min={MIN_BRUSH_SIZE} max={MAX_BRUSH_SIZE} onChange={(size) => change('setBrushSize', { ...settings, brushSize: clampBrushSize(size) })} format={(size) => `${size} px`} layout="row" />
        </div>
      </div>
      <div className="reference-editor__group" role="group" aria-label="Selection">
        <Button icon={<Icon name="invert" />} onClick={() => run('invert')} disabled={!state.hasSelection} title={needSelection ?? 'Selects what is not selected.'}>Invert</Button>
        <Button icon={<Icon name="fill" />} onClick={() => run('fill')} disabled={!state.hasSelection} title={needSelection ?? 'Covers the selection with the colour.'}>Fill</Button>
        <Button icon={<Icon name="crop" />} onClick={() => run('crop')} disabled={!state.hasSelection} title={needSelection ?? 'Keeps only the selection’s box; unselected pixels inside it get the colour.'}>Crop</Button>
      </div>
      <div className="reference-editor__group" role="group" aria-label="History">
        <IconButton label="Undo" hint={state.droppedOlder ? HISTORY_DROPPED : 'Takes back the last step.'} icon={<Icon name="undo" />} disabled={!state.canUndo} onClick={() => run('undo')} />
        <IconButton label="Redo" icon={<Icon name="redo" />} disabled={!state.canRedo} onClick={() => run('redo')} />
      </div>
      <div className="reference-editor__group reference-editor__group--view" role="group" aria-label="View">
        <IconButton label="Zoom out" hint="Halves the zoom." icon={<Icon name="zoom-out" />} onClick={() => stage.current?.zoom(0.5)} />
        <IconButton label="Zoom in" hint="Doubles the zoom." icon={<Icon name="zoom-in" />} onClick={() => stage.current?.zoom(2)} />
        <IconButton label="Fit" hint="Shows the whole picture." icon={<Icon name="fit" />} onClick={() => stage.current?.fit()} />
      </div>
    </div>
  );
}

/** 0xFFBBGGRR to "#rrggbb" (the colour input's format). */
export function hexOf(word: number): string {
  const channel = (shift: number): string => ((word >> shift) & 255).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(8)}${channel(16)}`;
}
const wordOf = (hex: string): number => {
  const value = Number.parseInt(hex.slice(1, 7), 16);
  return (0xff000000 | ((value & 255) << 16) | (value & 0xff00) | ((value >> 16) & 255)) >>> 0;
};
