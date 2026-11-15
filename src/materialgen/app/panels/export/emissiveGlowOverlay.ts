import type { StageOverlay } from '@shared/ui-kit';
import type { PixelImage } from '@mat/imageops';
import { paintCoverageOverlay } from '@mat/masks';

const EMISSIVE_GLOW = '#FFC83D'; // the glow colour of the emissive dialog's overlay (export R39)

/** Export R39: the overlay of the emissive dialog: the coverage lit in the glow colour, its soft edge as a soft alpha. */
export function buildGlowOverlay(coverage: PixelImage): StageOverlay {
  return { width: coverage.width, height: coverage.height, rgba: paintCoverageOverlay(coverage, EMISSIVE_GLOW) };
}
