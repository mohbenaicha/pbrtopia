import { useEffect, useRef, useState } from 'react';
import { canLeaveRoute } from './routeGuard';
import type { Route, Router } from './router';
import { decideStartup, type StartupDecision, type StartupStore } from './startup';

const isSameProject = (a: Route, b: Route): boolean => a.view === 'project' && b.view === 'project' && a.id === b.id;

/**
 * The route the address stands for, kept up to date as it changes (Back, Forward, typed, buttons). Every address goes through the start rules
 * (a bare or unusable one is rewritten, a missing project lands on the list with a line), and a move away from a guarded view waits for its guard:
 * when the guard refuses, the old address is put back (projects R5, R6, R15).
 */
export function useAddressWatcher<Section extends string>(
  store: StartupStore,
  initial: StartupDecision<Section>,
  router: Router<Section>,
): { route: Route<Section>; notice: StartupDecision['notice']; dismissNotice(): void } {
  const [route, setRoute] = useState(initial.route);
  const [notice, setNotice] = useState(initial.notice);
  const accepted = useRef({ hash: window.location.hash, route: initial.route });
  const latestMove = useRef(0);

  useEffect(
    () =>
      router.watchRoute(window, () => {
        const move = ++latestMove.current; // a newer address supersedes one still waiting on the store or the guard
        void (async () => {
          const decision = await decideStartup(window.location.hash, store, router);
          if (move !== latestMove.current) return;
          if (!isSameProject(decision.route, accepted.current.route) && !(await canLeaveRoute())) {
            if (move === latestMove.current) window.history.replaceState(null, '', accepted.current.hash);
            return;
          }
          if (move !== latestMove.current) return;
          if (decision.replaceHash !== null) window.history.replaceState(null, '', decision.replaceHash);
          accepted.current = { hash: window.location.hash, route: decision.route };
          setRoute(decision.route);
          setNotice(decision.notice);
        })();
      }),
    [store, router],
  );

  return { route, notice, dismissNotice: () => setNotice(null) };
}
