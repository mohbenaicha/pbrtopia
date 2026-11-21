export interface PaletteColour {
  name: string; // a plain colour word an image model can follow
  hex: string; // #RRGGBB
}

/** What the masks record keeps for each component in use (masks R10). */
export interface LabelColour extends PaletteColour {
  label: number;
}

/** Masks R9: ten colours far apart in Lab (the test checks every pair is at least 30 apart). */
export const PALETTE: readonly PaletteColour[] = [
  { name: 'red', hex: '#FF0000' },
  { name: 'green', hex: '#00FF00' },
  { name: 'blue', hex: '#0000FF' },
  { name: 'yellow', hex: '#FFFF00' },
  { name: 'magenta', hex: '#FF00FF' },
  { name: 'cyan', hex: '#00FFFF' },
  { name: 'black', hex: '#000000' },
  { name: 'white', hex: '#FFFFFF' },
  { name: 'orange', hex: '#FF8000' },
  { name: 'purple', hex: '#800080' },
];

/** Masks R10: for N components, entry k is component k's colour; its index is its label. */
export function paletteFor(count: number): LabelColour[] {
  if (!Number.isInteger(count) || count < 1 || count > PALETTE.length) throw new RangeError(`A palette holds 1 to ${PALETTE.length} colours, not ${count}.`);
  return PALETTE.slice(0, count).map((entry, label) => ({ label, hex: entry.hex, name: entry.name }));
}
