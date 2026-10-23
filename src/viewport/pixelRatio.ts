interface PixelRatioSource {
  devicePixelRatio: number;
  matchMedia(query: string): {
    addEventListener(type: 'change', listener: () => void): void;
    removeEventListener(type: 'change', listener: () => void): void;
  };
}

// Reports each change of devicePixelRatio (another monitor, browser zoom). A resolution media query only fires once per value, so it is re-armed for the new value after every change. Returns a function that stops watching.
export function watchPixelRatio(onChange: (ratio: number) => void, source: PixelRatioSource = window): () => void {
  let disarm = (): void => undefined;

  const arm = (): void => {
    const query = source.matchMedia(`(resolution: ${source.devicePixelRatio}dppx)`);
    const listener = (): void => {
      disarm();
      onChange(source.devicePixelRatio);
      arm();
    };
    query.addEventListener('change', listener);
    disarm = () => query.removeEventListener('change', listener);
  };

  arm();
  return () => disarm();
}
