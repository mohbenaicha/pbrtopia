import './HintLine.css';

export const DEFAULT_HINT = 'Right-drag orbit, middle-drag pan, scroll zoom';

export function HintLine({ text = DEFAULT_HINT }: { text?: string }): React.JSX.Element {
  return <p className="viewport-hint">{text}</p>;
}
