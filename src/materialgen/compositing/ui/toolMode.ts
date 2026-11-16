/**
 * Clone architecture C1: one of the Paint tool's two ways of working (Stamp, Clone) on the shared workspace. A mode takes the pointer and the keys while it is
 * attached and gives them back on `detach`, dropping whatever it had not confirmed; it never disposes the session or the preview's textures (the workspace does).
 */
export interface ToolMode {
  attach(): void;
  detach(): void;
  /** True while the mode needs animation frames although the session has nothing queued (a stroke is open). */
  isBusy(): boolean;
  /** The preview's surface changed (Tiling, height Scale or Level): the mode places its ghost and markers again (compositing R56). */
  surfaceChanged(): void;
  /** True while Undo and Redo (buttons and keys) must do nothing, because the mode holds work that is not in the history yet (clone R16: a floating copy). */
  locksHistory?(): boolean;
  /** Called once per animation frame the workspace runs, so a mode can follow the camera (clone R23: handles are drawn in screen space). */
  onFrame?(): void;
}
