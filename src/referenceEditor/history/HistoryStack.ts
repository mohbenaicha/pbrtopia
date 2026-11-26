import type { Bounds } from '../model/geometry';
import type { Raster } from '../model/raster';
import type { SelectionMask } from '../model/selectionMask';
import type { TileJournal } from './TileJournal';

export interface ReplaceState { raster?: Raster; mask?: SelectionMask }

/** Three kinds only (architecture D6): touched-tile journals, self-inverse invert, and whole-object replacement (crop, clear selection). */
export type Command =
  | { kind: 'tiles'; journal: TileJournal; changesPixels: boolean }
  | { kind: 'invert'; boundsBefore: Bounds }
  | { kind: 'replace'; before: ReplaceState; after: ReplaceState; changesPixels: boolean };

const INVERT_BYTES = 64;
const replaceBytes = (state: ReplaceState): number => (state.raster?.bytes.byteLength ?? 0) + (state.mask?.cells.byteLength ?? 0);
export const commandBytes = (command: Command): number => (command.kind === 'tiles' ? command.journal.bytes : command.kind === 'invert' ? INVERT_BYTES : replaceBytes(command.before) + replaceBytes(command.after));
const changesPixels = (command: Command | null | undefined): boolean => command !== null && command !== undefined && command.kind !== 'invert' && command.changesPixels;

/**
 * Done commands in [head, doneEnd), undone ones in [doneEnd, items.length). `bytes` counts both. Oldest done commands are evicted in
 * O(1) each when the byte budget is passed (the newest is always kept); the array is compacted when the evicted prefix passes half.
 */
export class HistoryStack {
  private items: (Command | null)[] = [];
  private head = 0;
  private doneEnd = 0;
  private pixelCommandsDone = 0;
  bytes = 0;
  droppedOlder = false;
  evictedPixelCommand = false;

  constructor(private readonly budget: number) {}

  get canUndo(): boolean { return this.doneEnd > this.head; }
  get canRedo(): boolean { return this.doneEnd < this.items.length; }
  get hasPixelCommand(): boolean { return this.pixelCommandsDone > 0 || this.evictedPixelCommand; }

  push(command: Command): void {
    for (let k = this.doneEnd; k < this.items.length; k += 1) this.bytes -= commandBytes(this.items[k]!);
    this.items.length = this.doneEnd;
    this.items.push(command);
    this.doneEnd += 1;
    this.bytes += commandBytes(command);
    if (changesPixels(command)) this.pixelCommandsDone += 1;
    while (this.bytes > this.budget && this.head < this.doneEnd - 1) this.evictOldest();
    if (this.head > 32 && this.head * 2 > this.items.length) {
      this.items = this.items.slice(this.head);
      this.doneEnd -= this.head;
      this.head = 0;
    }
  }

  /** Moves the newest done command to the undone side and returns it for the caller to apply, or null. */
  undo(): Command | null {
    if (!this.canUndo) return null;
    this.doneEnd -= 1;
    const command = this.items[this.doneEnd]!;
    if (changesPixels(command)) this.pixelCommandsDone -= 1;
    return command;
  }

  redo(): Command | null {
    if (!this.canRedo) return null;
    const command = this.items[this.doneEnd]!;
    this.doneEnd += 1;
    if (changesPixels(command)) this.pixelCommandsDone += 1;
    return command;
  }

  private evictOldest(): void {
    const command = this.items[this.head]!;
    this.bytes -= commandBytes(command);
    this.items[this.head] = null;
    this.head += 1;
    this.droppedOlder = true;
    if (changesPixels(command)) { this.evictedPixelCommand = true; this.pixelCommandsDone -= 1; }
  }
}
