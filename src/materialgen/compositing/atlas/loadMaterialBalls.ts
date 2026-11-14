import sheetUrl from './material_balls.webp?url';
import manifest from './material_balls.json';

/** The ball sheet's address, for the picker tiles and the swatch (a CSS background cut to one ball). */
export const MATERIAL_BALLS_URL: string = sheetUrl;

const cells: ReadonlyMap<string, number> = new Map(manifest.names.map((name, index) => [name, index]));

/** Compositing R54: the cell of a material's baked ball in the sheet, or undefined when the sheet does not know the name. */
export function ballCellOf(name: string): number | undefined {
  return cells.get(name);
}

/** Compositing R54: the CSS that shows one cell of the sheet at `size` px (cells run left to right, then top to bottom). */
export function ballCutOf(cell: number, size: number): { backgroundImage: string; backgroundSize: string; backgroundPosition: string } {
  const side = manifest.columns * size;
  return {
    backgroundImage: `url(${sheetUrl})`,
    backgroundSize: `${side}px ${side}px`,
    backgroundPosition: `${-(cell % manifest.columns) * size}px ${-Math.floor(cell / manifest.columns) * size}px`,
  };
}
