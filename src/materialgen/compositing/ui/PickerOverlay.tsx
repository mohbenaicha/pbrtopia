import { Dialog } from '@shared/ui-kit';

interface PickerOverlayProps {
  title: string;
  onClose: () => void;
  /** Present for the material picker: a search field over the grid (R7); the shape picker has none (R6). */
  search?: { value: string; onChange: (value: string) => void; label: string };
  children: React.ReactNode;
}

/** Compositing A10: the one overlay of both pickers, on the app's Dialog layer: an optional search field over a scrolling grid. */
export function PickerOverlay({ title, onClose, search, children }: PickerOverlayProps): React.JSX.Element {
  return (
    <Dialog open title={title} onClose={onClose} size="large">
      {search !== undefined && (
        <input
          className="picker-overlay__search"
          type="search"
          aria-label={search.label}
          placeholder={search.label}
          value={search.value}
          onChange={(event) => search.onChange(event.target.value)}
          autoFocus
        />
      )}
      <div className="picker-overlay__grid-scroll">{children}</div>
    </Dialog>
  );
}
