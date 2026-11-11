export const MAX_TRAIL = 20;

/** Generation R72-R74: the ideas now offered, every idea shown so far (to tell an unedited idea from the user's own text), and the trail of the user's own texts, newest last. */
export interface IdeasState {
  ideas: readonly string[];
  known: readonly string[];
  trail: readonly string[];
}

export const EMPTY_IDEAS: IdeasState = { ideas: [], known: [], trail: [] };

/** R74: pushes a text unless it is blank, equals the top of the trail, or is an idea shown in this session; keeps the newest MAX_TRAIL. */
function pushOwnText(state: IdeasState, text: string): IdeasState {
  if (text.trim() === '' || state.trail.at(-1) === text || state.known.includes(text)) return state;
  return { ...state, trail: [...state.trail, text].slice(-MAX_TRAIL) };
}

/** R72: a set arrived: it replaces the earlier one whole; the trail is untouched (only a pick pushes). */
export function receiveIdeas(state: IdeasState, ideas: readonly string[]): IdeasState {
  return { ...state, ideas, known: [...state.known, ...ideas.filter((idea) => !state.known.includes(idea))] };
}

/** R73, R74: the user picked an idea: it becomes the text; what the field held is kept on the trail by the rule above. */
export function pickIdea(state: IdeasState, current: string, index: number): { state: IdeasState; text: string } {
  return { state: pushOwnText(state, current), text: state.ideas[index] ?? current };
}

/** R74: Reset: the top of the trail becomes the text; null when there is nothing to go back to. */
export function resetToPrevious(state: IdeasState): { state: IdeasState; text: string } | null {
  const text = state.trail.at(-1);
  return text === undefined ? null : { state: { ...state, trail: state.trail.slice(0, -1) }, text };
}

export const canReset = (state: IdeasState): boolean => state.trail.length > 0;

/** R73: the number selected: the idea the field shows exactly, else null. */
export function selectedIdea(state: IdeasState, text: string): number | null {
  const at = state.ideas.indexOf(text);
  return at < 0 ? null : at;
}
