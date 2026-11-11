/** Preview R39: the mesh resolution levels 1 to 4, as segments per side. */
export const MESH_SEGMENTS = [128, 256, 384, 512] as const;

export function segmentsFor(level: number): number {
  const index = Math.min(MESH_SEGMENTS.length, Math.max(1, Math.round(level))) - 1;
  return MESH_SEGMENTS[index]!;
}
