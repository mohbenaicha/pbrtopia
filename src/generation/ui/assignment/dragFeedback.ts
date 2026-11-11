// Custom R3: drag feedback is written straight on the DOM (data attributes the stylesheet draws), so moving the pointer over the cards
// re-renders nothing.

// A card shows its hint on its drop area; the snapshot row on itself.
const hintTargetOf = (current: HTMLElement): HTMLElement => current.querySelector<HTMLElement>('.setup-drop') ?? current;

// The target says what dropping here would do; the stylesheet draws it over the target.
export function showDropHint(current: HTMLElement, label: string): void {
  hintTargetOf(current).dataset['dropHint'] = label;
}

// A dragged image card shows an insertion bar on the edge of the hovered card where it would land.
export function showDropEdge(card: HTMLElement, edge: 'before' | 'after'): void {
  card.dataset['dropEdge'] = edge;
}

export function clearDropHint(current: HTMLElement): void {
  delete hintTargetOf(current).dataset['dropHint'];
  delete current.dataset['dropEdge'];
}

// True when the pointer has really left `event.currentTarget` (and not just moved onto one of its children).
export function hasLeftTarget(event: React.DragEvent): boolean {
  return !event.currentTarget.contains(event.relatedTarget as Node | null);
}

// The dragged element dims until the drag ends, and `ghost` (the picture or card being carried) follows the pointer.
export function markDragSource(source: HTMLElement, event: React.DragEvent, ghost: HTMLElement | null): void {
  source.dataset['dragging'] = '';
  source.addEventListener('dragend', () => delete source.dataset['dragging'], { once: true });
  if (ghost !== null) event.dataTransfer.setDragImage(ghost, ghost.clientWidth / 2, ghost.clientHeight / 2);
}
