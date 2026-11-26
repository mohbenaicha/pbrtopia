/** One table of key bindings for the editor (architecture D17). Space (pan) is handled on its own: it needs key-up too. */
export type KeyAction = 'undo' | 'redo' | 'brushSmaller' | 'brushLarger' | 'escape' | 'panLeft' | 'panRight' | 'panUp' | 'panDown';

export interface KeyInput { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }

export function keyActionOf(event: KeyInput): KeyAction | null {
  const command = event.ctrlKey || event.metaKey;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (command && key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (command && key === 'y') return 'redo';
  if (command) return null;
  switch (key) {
    case '[': return 'brushSmaller';
    case ']': return 'brushLarger';
    case 'Escape': return 'escape';
    case 'ArrowLeft': return 'panLeft';
    case 'ArrowRight': return 'panRight';
    case 'ArrowUp': return 'panUp';
    case 'ArrowDown': return 'panDown';
    default: return null;
  }
}
