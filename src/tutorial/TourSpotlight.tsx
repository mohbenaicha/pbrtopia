import type { Box } from './placeCard';

export const SPOTLIGHT_PADDING_PX = 6;
const RING_INSET_PX = 1;

/** The veil's hole over the target (tutorial R5): the veil is the hole's outsized shadow, so the target's own pixels stay bright, under a very translucent accent fill and a dashed ring that marches. */
export function TourSpotlight({ box }: { box: Box }): React.JSX.Element {
  const left = box.left - SPOTLIGHT_PADDING_PX;
  const top = box.top - SPOTLIGHT_PADDING_PX;
  const width = box.width + SPOTLIGHT_PADDING_PX * 2;
  const height = box.height + SPOTLIGHT_PADDING_PX * 2;
  return (
    <div className="tour-spotlight" style={{ left, top, width, height }} aria-hidden="true">
      <svg className="tour-spotlight__ring" width={width} height={height}>
        <rect x={RING_INSET_PX} y={RING_INSET_PX} width={Math.max(0, width - RING_INSET_PX * 2)} height={Math.max(0, height - RING_INSET_PX * 2)} rx="8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="8 6" />
      </svg>
    </div>
  );
}
