import type { RunStatus } from './runTypes';

export interface OutcomeFacts {
  aborted: boolean;
  failureCount: number;
  finishedImages: number;
  totalImages: number;
  keptNames: readonly string[]; // maps kept by this run and earlier attempts of it, in plan order; Metal-Roughness for the decomposition
}

/** R43, R60: the status and the one line a run ends with. */
export function describeRunOutcome({ aborted, failureCount, finishedImages, totalImages, keptNames }: OutcomeFacts): { status: RunStatus; message: string } {
  if (aborted) return { status: 'cancelled', message: keptNames.length > 0 ? `Cancelled. Kept: ${keptNames.join(', ')}.` : 'Cancelled.' };
  if (failureCount === 0 && finishedImages === totalImages) return { status: 'done', message: `Generated: ${keptNames.join(', ')}` };
  return { status: finishedImages > 0 ? 'partial' : 'failed', message: `Generated ${finishedImages} of ${totalImages} images` };
}

export const PACKED_NOTE = 'Maps from one image may not line up exactly'; // R50
