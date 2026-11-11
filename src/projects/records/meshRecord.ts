// The stored shape of a project's mesh. It lives with the records so that the shared storage code does not reach into the projection engine (materialgen-prep R67).

// 'none' = the mesh has no UVs yet (generation is blocked until ensureUvs runs, engine R45).
export type UvSource = 'file' | 'generated' | 'none';

export interface UnwrapOptions {
  resolution: 1024 | 2048 | 4096;
  paddingTexels: number;
}

export interface UnwrapReport {
  options: UnwrapOptions;
  vertsBefore: number;
  vertsAfter: number;
  ms: number;
  library: string;
  libraryVersion: string;
}

export interface MeshRecord {
  id: string;
  name: string;
  vertexCount: number;
  triangleCount: number;
  uvSource: UvSource;
  unwrap?: UnwrapReport;
}
