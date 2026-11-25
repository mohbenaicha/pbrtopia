import { findIslands } from '../findIslands';
import { GROWTH, INSIDE, rasterizeIslandMask, type IslandMask } from '../rasterizeIslandMask';
import type { UvMesh } from '../uprightTypes';

const MAX_OWNER = 65535;

/**
 * normal-height-edit R1 (Words): which island owns each texel of the albedo's layout. 0 = nobody, else island index + 1 (islands past 65534 share the last number).
 * Built from the mesh alone, over every island, so generation and the panel's load build the identical map. The growth of every island is claimed first, then every
 * island's own triangle texels, which win over any growth (as `unpackNormals` does); a tie between growths, or between overlapping inside texels, goes to the lower island.
 */
export function buildOwnerMap(mesh: UvMesh, side: number): Uint16Array {
  const owner = new Uint16Array(side * side);
  const masks = findIslands(mesh).map((triangles) => rasterizeIslandMask(mesh, triangles, side));
  for (let index = 0; index < masks.length; index += 1) claim(masks[index]!, GROWTH, Math.min(index + 1, MAX_OWNER), owner, side, false);
  for (let index = masks.length - 1; index >= 0; index -= 1) claim(masks[index]!, INSIDE, Math.min(index + 1, MAX_OWNER), owner, side, true);
  return owner;
}

function claim(island: IslandMask, wanted: number, number: number, owner: Uint16Array, side: number, overwrite: boolean): void {
  for (let my = 0; my < island.height; my += 1) {
    const y = island.minY + my;
    if (y < 0 || y >= side) continue;
    for (let mx = 0; mx < island.width; mx += 1) {
      if (island.mask[my * island.width + mx] !== wanted) continue;
      const x = island.minX + mx;
      if (x < 0 || x >= side) continue;
      const at = y * side + x;
      if (overwrite || owner[at] === 0) owner[at] = number;
    }
  }
}
