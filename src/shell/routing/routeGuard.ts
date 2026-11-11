/** Decides whether the view on screen may be left: true lets the move happen, false keeps the view (the guard shows its own reason). */
type RouteGuard = () => Promise<boolean>;

let current: RouteGuard | null = null;
let nextMoveAllowed = false;

/** The one view that needs a say in being left (the open project) registers here; null removes it. */
export function setRouteGuard(guard: RouteGuard | null): void {
  current = guard;
  nextMoveAllowed = false;
}

/** A button has already done the leaving (saved the set, forgot the project): its own address change needs no second check. */
export function allowNextMove(): void {
  nextMoveAllowed = true;
}

/** Asks the registered guard; with none, or for a move a button already prepared, any move is allowed. */
export function canLeaveRoute(): Promise<boolean> {
  if (nextMoveAllowed) {
    nextMoveAllowed = false;
    return Promise.resolve(true);
  }
  return current === null ? Promise.resolve(true) : current();
}
