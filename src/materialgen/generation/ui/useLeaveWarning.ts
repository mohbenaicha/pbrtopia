import { useEffect } from 'react';

/** Generation R76: while `armed`, a reload, closed tab or typed address makes the browser show its own "Leave site?" prompt. */
export function useLeaveWarning(armed: boolean): void {
  useEffect(() => {
    if (!armed) return undefined;
    const warn = (event: BeforeUnloadEvent): void => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [armed]);
}
