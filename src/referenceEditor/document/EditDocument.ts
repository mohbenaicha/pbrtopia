import { HistoryStack, type Command, type ReplaceState } from '../history/HistoryStack';
import { createTileJournal, isJournalEmpty, swapJournal, type TileJournal } from '../history/TileJournal';
import { isEmptyBounds, type Rect } from '../model/geometry';
import type { Raster } from '../model/raster';
import { createSelectionMask, hasSelection, type SelectionMask } from '../model/selectionMask';
import { cropToSelection } from '../ops/cropToSelection';
import { fillSelection } from '../ops/fillSelection';
import { invertSelection } from '../ops/invertSelection';

const MIB = 1024 * 1024;

/** What an edit changed on screen: tile/region rectangles or everything, and whether the picture's size changed (the stage refits). */
export interface DocumentChange { dirty: Rect[] | 'all'; relayout: boolean }
export interface DocumentOptions { budgetBytes?: number }

/** The only owner of the working picture, the selection and the history; every change goes through a command so undo and redo are exact. */
export class EditDocument {
  raster: Raster;
  mask: SelectionMask;
  private readonly history: HistoryStack;

  private constructor(raster: Raster, budget: number) {
    this.raster = raster;
    this.mask = createSelectionMask(raster.width, raster.height);
    this.history = new HistoryStack(budget);
  }

  static create(raster: Raster, options: DocumentOptions = {}): EditDocument {
    return new EditDocument(raster, options.budgetBytes ?? Math.min(192 * MIB, Math.max(32 * MIB, 4 * raster.bytes.byteLength)));
  }

  get hasSelection(): boolean { return hasSelection(this.mask); }
  get pixelChanged(): boolean { return this.history.hasPixelCommand; }
  get droppedOlder(): boolean { return this.history.droppedOlder; }
  get historyBytes(): number { return this.history.bytes; }
  get canUndo(): boolean { return this.history.canUndo; }
  get canRedo(): boolean { return this.history.canRedo; }

  beginJournal(): TileJournal { return createTileJournal(this.raster, this.mask); }
  /** Pushes a finished tile journal; an empty one (nothing was written) is dropped. */
  push(command: Command): void {
    if (command.kind === 'tiles' && isJournalEmpty(command.journal)) return;
    this.history.push(command);
  }

  invert(): DocumentChange {
    this.history.push({ kind: 'invert', boundsBefore: { ...this.mask.bounds } });
    invertSelection(this.mask);
    return { dirty: 'all', relayout: false };
  }

  fill(colour: number): DocumentChange | null {
    const journal = this.beginJournal();
    const rect = fillSelection(this.raster, this.mask, colour, journal);
    if (rect === null) return null;
    this.push({ kind: 'tiles', journal, changesPixels: true });
    return { dirty: [rect], relayout: false };
  }

  crop(colour: number): DocumentChange | null {
    if (!this.hasSelection) return null;
    const before: ReplaceState = { raster: this.raster, mask: this.mask };
    const made = cropToSelection(this.raster, this.mask, colour);
    const after: ReplaceState = { raster: made.raster, mask: made.mask };
    this.history.push({ kind: 'replace', before, after, changesPixels: true });
    this.apply(after);
    return { dirty: 'all', relayout: true };
  }

  clearSelection(): DocumentChange | null {
    if (!this.hasSelection) return null;
    const before: ReplaceState = { mask: this.mask };
    const after: ReplaceState = { mask: createSelectionMask(this.raster.width, this.raster.height) };
    this.history.push({ kind: 'replace', before, after, changesPixels: false });
    this.apply(after);
    return { dirty: 'all', relayout: false };
  }

  /** Runs one of the toolbar's document commands; null when it had nothing to do. */
  perform(command: 'undo' | 'redo' | 'invert' | 'fill' | 'crop', colour: number): DocumentChange | null {
    switch (command) {
      case 'undo': return this.undo();
      case 'redo': return this.redo();
      case 'invert': return this.invert();
      case 'fill': return this.fill(colour);
      case 'crop': return this.crop(colour);
    }
  }

  undo(): DocumentChange | null {
    const command = this.history.undo();
    return command === null ? null : this.run(command, 'before');
  }

  redo(): DocumentChange | null {
    const command = this.history.redo();
    return command === null ? null : this.run(command, 'after');
  }

  private run(command: Command, direction: 'before' | 'after'): DocumentChange {
    if (command.kind === 'tiles') return { dirty: swapJournal(command.journal, this.raster, this.mask), relayout: false };
    if (command.kind === 'invert') {
      invertSelection(this.mask);
      if (direction === 'before') this.mask.bounds = { ...command.boundsBefore };
      if (!isEmptyBounds(this.mask.bounds)) this.mask.tileHas.fill(1); // the flags were zeroed when the invert emptied the selection
      return { dirty: 'all', relayout: false };
    }
    const state = command[direction];
    const relayout = state.raster !== undefined && state.raster !== this.raster;
    this.apply(state);
    return { dirty: 'all', relayout };
  }

  private apply(state: ReplaceState): void {
    if (state.raster !== undefined) this.raster = state.raster;
    if (state.mask !== undefined) this.mask = state.mask;
  }
}
