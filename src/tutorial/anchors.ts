/** The selector of the element a step circles (tutorial R10). */
export function anchorSelector(id: string): string {
  return `[data-tutorial="${id}"]`;
}

/** Waits for the anchor to be in the page: found at once, or when it is added, or null after `timeoutMs` or when aborted (tutorial R8). */
export function waitForAnchor(id: string, timeoutMs: number, signal: AbortSignal): Promise<Element | null> {
  const selector = anchorSelector(id);
  return new Promise((resolve) => {
    const present = document.querySelector(selector);
    if (present !== null) return resolve(present);
    if (signal.aborted) return resolve(null);

    const finish = (element: Element | null): void => {
      observer.disconnect();
      window.clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve(element);
    };
    const onAbort = (): void => finish(null);
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element !== null) finish(element);
    });
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-tutorial'] });
    signal.addEventListener('abort', onAbort);
  });
}
