// The line icon set: 24x24, stroke 1.75, round caps and joins. Each icon is a list of SVG path strings.
export const LINE_ICON_PATHS = {
  gear: [
    // eight square-shouldered teeth on a round body, a round hole in the middle
    'M10.21 4.82L10.5 2.52H13.5L13.79 4.82A7.4 7.4 0 0 1 15.81 5.66L17.64 4.23L19.77 6.36L18.34 8.19A7.4 7.4 0 0 1 19.18 10.21L21.48 10.5V13.5L19.18 13.79A7.4 7.4 0 0 1 18.34 15.81L19.77 17.64L17.64 19.77L15.81 18.34A7.4 7.4 0 0 1 13.79 19.18L13.5 21.48H10.5L10.21 19.18A7.4 7.4 0 0 1 8.19 18.34L6.36 19.77L4.23 17.64L5.66 15.81A7.4 7.4 0 0 1 4.82 13.79L2.52 13.5V10.5L4.82 10.21A7.4 7.4 0 0 1 5.66 8.19L4.23 6.36L6.36 4.23L8.19 5.66A7.4 7.4 0 0 1 10.21 4.82Z',
    'M12 9.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Z',
  ],
  'chevron-down': ['M6 9l6 6 6-6'],
  'chevron-right': ['M9 6l6 6-6 6'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  reset: ['M4 12a8 8 0 1 0 2.5-5.8', 'M4 4v5h5'],
  plus: ['M12 5v14', 'M5 12h14'],
  'arrow-right': ['M5 12h14', 'M13 6l6 6-6 6'],
  download: ['M12 4v11', 'M7.5 11l4.5 4.5 4.5-4.5', 'M5 19.5h14'],
  apply: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z', 'M8 12.3l2.9 2.9 5.3-5.7'],
  // A cube drawn with its front three faces and a down arrow (textures R16).
  'model-download': ['M10 3.5l6.5 3.7v7.6L10 18.5 3.5 14.8V7.2z', 'M3.5 7.2L10 11l6.5-3.8', 'M10 11v7.5', 'M19 12.5v8', 'M16.5 18l2.5 2.5 2.5-2.5'],
  upload: ['M12 15V4', 'M7.5 8L12 3.5 16.5 8', 'M5 19.5h14'],
  pencil: ['M4.5 19.5l.9-4L16 4.9a2 2 0 0 1 3.1 3.1L8.5 18.6z', 'M14.5 6.5l3 3'],
  save: ['M4.5 4.5h12l3 3v12h-15z', 'M8 4.5V9h7V4.5', 'M7.5 19.5v-6h9v6'], // a floppy disc: shutter on top, label below
  trash: ['M5 7h14', 'M9.5 7V4.5h5V7', 'M7 7l.8 12.5h8.4L17 7', 'M10 11v5', 'M14 11v5'],
  projects: ['M4 4h6.5v6.5H4z', 'M13.5 4H20v6.5h-6.5z', 'M4 13.5h6.5V20H4z', 'M13.5 13.5H20V20h-6.5z'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z'],
  bug: ['M8.5 10h7v4.5a3.5 4 0 0 1-7 0z', 'M9.5 10V8.5a2.5 2.5 0 0 1 5 0V10', 'M5 12h3.5', 'M15.5 12H19', 'M6 7.5l2.8 2', 'M18 7.5l-2.8 2', 'M6 18l2.8-2', 'M18 18l-2.8-2'],
  grid: ['M4 4h16v16H4z', 'M9.3 4v16', 'M14.7 4v16', 'M4 9.3h16', 'M4 14.7h16'],
  // A cube with its three visible faces and a small arrow-head cursor at the front corner: edit the mesh (mesh edit R1).
  'edit-mesh': ['M10 3.5l6.5 3.7v7.6L10 18.5 3.5 14.8V7.2z', 'M3.5 7.2L10 11l6.5-3.8', 'M10 11v7.5', 'M15 13.5l5.5 2.5-2.4.9-.9 2.4z'],
  // The mesh edit toolbar (mesh edit R3).
  'select-box': ['M4 9V4h5', 'M15 4h5v5', 'M20 15v5h-5', 'M9 20H4v-5'], // marquee corners
  'select-lasso': ['M12 4.5c4.7 0 8 2 8 4.8s-3.3 4.8-8 4.8-8-2-8-4.8 3.3-4.8 8-4.8z', 'M8.5 13.6c-.6 2-.2 3.6 1.3 4.6 1.3.9 2 1.9 1.4 2.8'], // a loop with its dangling end
  move: ['M12 3v18', 'M3 12h18', 'M9 6l3-3 3 3', 'M9 18l3 3 3-3', 'M6 9l-3 3 3 3', 'M18 9l3 3-3 3'], // four arrows
  rotate: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4.5v4h-4', 'M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z'], // a clockwise arc around a centre dot
  scale: ['M4 14h6v6H4z', 'M14 10l6-6', 'M14.5 4H20v5.5'], // a small square with an arrow growing out of it
  'eye-off': ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z', 'M4.5 4.5l15 15'],
  undo: ['M9 14L4.5 9.5 9 5', 'M4.5 9.5h10a5 5 0 0 1 0 10H10'],
  redo: ['M15 14l4.5-4.5L15 5', 'M19.5 9.5h-10a5 5 0 0 0 0 10H14'],
  merge: ['M3.5 12h7', 'M7.5 8.5l3 3.5-3 3.5', 'M20.5 12h-7', 'M16.5 8.5l-3 3.5 3 3.5', 'M12 4.5v15'], // two arrows closing on a line
} as const;

export type LineIconName = keyof typeof LINE_ICON_PATHS;
