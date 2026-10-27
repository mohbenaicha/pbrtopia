// The line icon set: 24x24, stroke 1.75, round caps and joins. Each icon is a list of SVG path strings.
export const LINE_ICON_PATHS = {
  gear: [
    'M12 3.5l1.2 2.1 2.4-.6.9 2.3 2.3.9-.6 2.4 2.1 1.2-2.1 1.2.6 2.4-2.3.9-.9 2.3-2.4-.6L12 20.5l-1.2-2.1-2.4.6-.9-2.3-2.3-.9.6-2.4L3.7 12l2.1-1.2-.6-2.4 2.3-.9.9-2.3 2.4.6z',
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
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
  trash: ['M5 7h14', 'M9.5 7V4.5h5V7', 'M7 7l.8 12.5h8.4L17 7', 'M10 11v5', 'M14 11v5'],
  projects: ['M4 4h6.5v6.5H4z', 'M13.5 4H20v6.5h-6.5z', 'M4 13.5h6.5V20H4z', 'M13.5 13.5H20V20h-6.5z'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z'],
  bug: ['M8.5 10h7v4.5a3.5 4 0 0 1-7 0z', 'M9.5 10V8.5a2.5 2.5 0 0 1 5 0V10', 'M5 12h3.5', 'M15.5 12H19', 'M6 7.5l2.8 2', 'M18 7.5l-2.8 2', 'M6 18l2.8-2', 'M18 18l-2.8-2'],
  grid: ['M4 4h16v16H4z', 'M9.3 4v16', 'M14.7 4v16', 'M4 9.3h16', 'M4 14.7h16'],
} as const;

export type LineIconName = keyof typeof LINE_ICON_PATHS;
