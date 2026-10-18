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
} as const;

export type LineIconName = keyof typeof LINE_ICON_PATHS;
