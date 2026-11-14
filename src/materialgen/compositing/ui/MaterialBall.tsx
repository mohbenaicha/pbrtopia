import type { BaseMaterial } from '@mat/masks';
import { ballCellOf, ballCutOf } from '../atlas/loadMaterialBalls';

const SPHERE_HIGHLIGHT = 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.75), rgba(255,255,255,0) 42%)';

interface MaterialBallProps {
  material: BaseMaterial;
  size: number; // px
}

/**
 * Compositing R54: one lit ball, its cell of the baked sheet cut by CSS (nothing is drawn at run time). A material the sheet does not know is the flat circle of
 * its colour, shaded a little by its roughness.
 */
export function MaterialBall({ material, size }: MaterialBallProps): React.JSX.Element {
  const cell = ballCellOf(material.name);
  if (cell === undefined) {
    return (
      <span
        className="material-ball material-ball--flat"
        aria-hidden="true"
        style={{ width: size, height: size, background: `${SPHERE_HIGHLIGHT}, rgb(${material.rgb.join(',')})`, opacity: 1 - material.roughness * 0.25 }}
      />
    );
  }
  return <span className="material-ball" aria-hidden="true" data-ball-cell={cell} style={{ width: size, height: size, ...ballCutOf(cell, size) }} />;
}
