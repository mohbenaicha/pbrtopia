import { HANDLE_RADIUS, type HandleLayout } from '../clone/plan/dragPlacement';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface HandleLayer {
  /** Draws the copy's rectangle, its four corner handles and the rotation handle at these client pixels; null removes them (clone R9, R23). */
  show(layout: HandleLayout | null): void;
  dispose(): void;
}

const element = <K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string>): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
};

/**
 * Clone R9, R23: the handles are drawn in screen pixels, in one SVG over the window that never takes the pointer, so they stay the same size at any camera angle. The
 * controller hit-tests them from the same layout (dragPlacement.hitHandle).
 */
export function createHandleLayer(): HandleLayer {
  const svg = element('svg', { 'aria-hidden': 'true' });
  Object.assign(svg.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '60', display: 'none' });
  const outline = element('polygon', { fill: 'none', stroke: 'rgba(255,255,255,0.95)', 'stroke-width': '1.5', 'stroke-dasharray': '5 4' });
  const stem = element('line', { stroke: 'rgba(255,255,255,0.95)', 'stroke-width': '1.5' });
  const corners = [0, 1, 2, 3].map(() => element('rect', { width: String(HANDLE_RADIUS), height: String(HANDLE_RADIUS), fill: '#fff', stroke: '#1b6dff', 'stroke-width': '2' }));
  const rotate = element('circle', { r: String(HANDLE_RADIUS / 2), fill: '#fff', stroke: '#1b6dff', 'stroke-width': '2' });
  svg.append(outline, stem, ...corners, rotate);
  document.body.append(svg);
  let shown = '';

  return {
    show(layout) {
      if (layout === null) {
        if (shown !== '') svg.style.display = 'none';
        shown = '';
        return;
      }
      const key = JSON.stringify(layout);
      if (key === shown) return;
      shown = key;
      svg.style.display = 'block';
      outline.setAttribute('points', layout.corners.map((corner) => `${corner.x},${corner.y}`).join(' '));
      const top = { x: (layout.corners[2].x + layout.corners[3].x) / 2, y: (layout.corners[2].y + layout.corners[3].y) / 2 };
      stem.setAttribute('x1', String(top.x));
      stem.setAttribute('y1', String(top.y));
      stem.setAttribute('x2', String(layout.rotate.x));
      stem.setAttribute('y2', String(layout.rotate.y));
      layout.corners.forEach((corner, index) => {
        corners[index]!.setAttribute('x', String(corner.x - HANDLE_RADIUS / 2));
        corners[index]!.setAttribute('y', String(corner.y - HANDLE_RADIUS / 2));
      });
      rotate.setAttribute('cx', String(layout.rotate.x));
      rotate.setAttribute('cy', String(layout.rotate.y));
    },
    dispose: () => svg.remove(),
  };
}
