// Writes what is waiting the moment the page turns hidden (switching tab, closing it), which may be the last chance. Returns a function that stops listening.
export function flushOnTabHide(saver: { flush(): Promise<unknown> }, target: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> = document): () => void {
  const onChange = (): void => {
    if (target.visibilityState === 'hidden') void saver.flush();
  };
  target.addEventListener('visibilitychange', onChange);
  return () => target.removeEventListener('visibilitychange', onChange);
}
