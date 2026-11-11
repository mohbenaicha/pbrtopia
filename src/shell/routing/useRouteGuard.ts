import { useEffect, useRef } from 'react';
import { setRouteGuard } from './routeGuard';

/** Makes `canLeave` the guard of the address while this view is shown; it always runs the latest function given. */
export function useRouteGuard(canLeave: () => Promise<boolean>): void {
  const latest = useRef(canLeave);
  useEffect(() => {
    latest.current = canLeave;
  });
  useEffect(() => {
    setRouteGuard(() => latest.current());
    return () => setRouteGuard(null);
  }, []);
}
