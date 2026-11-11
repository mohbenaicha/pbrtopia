import { useRef, useState, type DragEvent } from 'react';

export interface DropZoneProps {
  onDragEnter(event: DragEvent): void;
  onDragOver(event: DragEvent): void;
  onDragLeave(event: DragEvent): void;
  onDrop(event: DragEvent): void;
}

const carriesFiles = (event: DragEvent): boolean => Array.from(event.dataTransfer?.types ?? []).includes('Files');

/**
 * Maps R34, R64: a zone files can be dropped on. `dragging` is set once when a file enters (children included) and cleared once when it
 * leaves or drops, not on every move event. The zone always takes the drop so the browser never opens the file; the caller refuses what it cannot use.
 */
export function useDropZone(onFiles: (files: File[]) => void): { dragging: boolean; zoneProps: DropZoneProps } {
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  return {
    dragging,
    zoneProps: {
      onDragEnter: (event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        depth.current += 1;
        if (depth.current === 1) setDragging(true);
      },
      onDragOver: (event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      },
      onDragLeave: (event) => {
        if (!carriesFiles(event)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      },
      onDrop: (event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        onFiles(Array.from(event.dataTransfer.files));
      },
    },
  };
}
