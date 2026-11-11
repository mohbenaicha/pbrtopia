import type { ReactNode } from 'react';

/** Prep S3 R22: something that is assigned to an image: a perspective (projection) or a map (materials). It holds no camera, trim or atlas word. */
export interface AssignmentItem {
  id: number;
  name: string;
  thumb: ReactNode; // what the item looks like in the row and on a card
  pinned?: boolean; // stays on its image: no remove button, no Unassign
  note?: string; // tooltip of the item in the row
}

/** One image card as the host draws it; the overlay adds the drag, drop and keyboard behaviour. */
export interface AssignmentCardView {
  itemIds: number[];
  preview?: ReactNode | null; // left out: no preview area at all; null: the empty drop frame with its text (prep S3 R27)
  below?: ReactNode; // under the drop area (a caveat, say)
  settings: ReactNode; // the card's model, resolution and quality
}

/** The words the overlay shows; the host owns every noun that is not "image". */
export interface AssignmentLabels {
  region: string; // the overlay's accessible name
  row: string; // the item row's group name
  emptyDrop: string; // an empty card's drop text
  busy?: string; // a loading cover over the row while its thumbnails are made
  assignedTo?: (imageNumber: number) => string; // the note under an item that is on an image; no note when the host gives none
}
