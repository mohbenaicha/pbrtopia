import type { CloneView } from './createCloneMode';

/** The single source of why a Clone control is disabled (clone R1, R6, R12, R16, R17). */
export const CLONE_REASONS = {
  floating: 'Confirm or press Esc on the copy first',
  empty: 'Paint a highlight first',
  tooLarge: 'The highlighted area is too large to copy',
  unmoved: 'Move, turn or scale the copy first',
  noStrength: 'Strength is 0, so nothing would change',
  nothingLifted: 'Press Clone first',
} as const;

/** Why the Clone button is disabled, or undefined when it is not. */
export function cloneButtonReason(view: CloneView): string | undefined {
  if (view.canClone) return undefined;
  if (view.phase === 'floating') return CLONE_REASONS.floating;
  return view.cloneBlocked === 'too-large' ? CLONE_REASONS.tooLarge : CLONE_REASONS.empty;
}

/** Why the Confirm button is disabled, or undefined when it is not. */
export function confirmButtonReason(view: CloneView): string | undefined {
  if (view.canConfirm) return undefined;
  if (view.phase === 'highlight') return CLONE_REASONS.nothingLifted;
  return view.confirmBlocked === 'no-strength' ? CLONE_REASONS.noStrength : CLONE_REASONS.unmoved;
}
