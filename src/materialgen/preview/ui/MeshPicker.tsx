import { useEffect, useRef, useState } from 'react';
import { Icon, IconButton, Popover, type IconName } from '@shared/ui-kit';
import { MESH_CHOICES, type PreviewMesh } from '@mat/storage';
import './meshPicker.css';

const MESH_LABELS: Record<PreviewMesh, string> = { ball: 'Ball', plane: 'Plane', materialBall: 'Material ball' };
const MESH_ICONS: Record<PreviewMesh, IconName> = { ball: 'mesh-ball', plane: 'mesh-plane', materialBall: 'mesh-material-ball' };

interface MeshPickerProps {
  mesh: PreviewMesh;
  onChoose: (mesh: PreviewMesh) => void;
}

/** Preview R27: shows the icon of the current mesh; a click opens a menu of the three meshes. Arrow keys move, Enter chooses, Escape or a click outside closes with no change. */
export function MeshPicker({ mesh, onChoose }: MeshPickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const items = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (open) items.current[MESH_CHOICES.indexOf(mesh)]?.focus();
  }, [open, mesh]);

  const move = (event: React.KeyboardEvent, step: number): void => {
    event.preventDefault();
    const at = items.current.findIndex((item) => item === document.activeElement);
    items.current[(at + step + MESH_CHOICES.length) % MESH_CHOICES.length]?.focus();
  };
  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown') move(event, 1);
    else if (event.key === 'ArrowUp') move(event, -1);
  };

  const trigger = <IconButton testId="preview-mesh-picker" label={`Preview mesh: ${MESH_LABELS[mesh]}`} icon={<Icon name={MESH_ICONS[mesh]} />} expanded={open} onClick={() => setOpen(!open)} />;
  return (
    <Popover open={open} onClose={() => setOpen(false)} label="Preview mesh" trigger={trigger}>
      <div className="mesh-picker__menu" role="menu" aria-label="Preview mesh" onKeyDown={onKeyDown}>
        {MESH_CHOICES.map((choice, index) => (
          <button
            key={choice}
            ref={(element) => {
              items.current[index] = element;
            }}
            type="button"
            role="menuitemradio"
            aria-checked={choice === mesh}
            className="mesh-picker__item"
            onClick={() => {
              setOpen(false);
              onChoose(choice);
            }}
          >
            <Icon name={MESH_ICONS[choice]} size={22} />
            {MESH_LABELS[choice]}
          </button>
        ))}
      </div>
    </Popover>
  );
}
