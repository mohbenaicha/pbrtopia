import { Button } from '../../ui-kit';

interface SelectionBarProps {
  count: number;
  deleteSelected: () => void;
  clear: () => void;
}

// Shown while projects are selected: how many, and what can be done with them.
export function SelectionBar({ count, deleteSelected, clear }: SelectionBarProps): React.JSX.Element {
  return (
    <div className="project-selection-bar">
      <span>{`${count} selected`}</span>
      <Button variant="danger" onClick={deleteSelected}>Delete selected</Button>
      <Button variant="ghost" onClick={clear}>Clear</Button>
    </div>
  );
}
