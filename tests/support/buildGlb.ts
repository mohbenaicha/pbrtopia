// Builds tiny binary glTF files for tests: meshes of positions, optional indices and UVs, optional node translation.
export interface GlbMeshSpec {
  name: string;
  positions: number[];
  indices?: number[];
  uvs?: number[];
  translation?: [number, number, number];
  scale?: [number, number, number];
}

export interface GlbOptions {
  externalBufferUri?: string; // makes the buffer an external file reference instead of the embedded BIN chunk
}

function padTo4(bytes: Uint8Array, fill: number): Uint8Array {
  const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4).fill(fill);
  padded.set(bytes);
  return padded;
}

export function buildGlb(meshes: GlbMeshSpec[], options: GlbOptions = {}): ArrayBuffer {
  const buffers: Uint8Array[] = [];
  const bufferViews: object[] = [];
  const accessors: object[] = [];
  let byteOffset = 0;

  const addAccessor = (data: Float32Array | Uint32Array, type: string, componentType: number, target: number) => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    buffers.push(bytes);
    bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length, target });
    byteOffset += bytes.length;
    const count = type === 'VEC3' ? data.length / 3 : type === 'VEC2' ? data.length / 2 : data.length;
    const extra = type === 'VEC3' ? boundsOf(data as Float32Array) : {};
    accessors.push({ bufferView: bufferViews.length - 1, componentType, count, type, ...extra });
    return accessors.length - 1;
  };

  const boundsOf = (positions: Float32Array) => {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis]!, positions[i + axis]!);
        max[axis] = Math.max(max[axis]!, positions[i + axis]!);
      }
    }
    return { min, max };
  };

  const gltfMeshes = meshes.map((mesh) => {
    const attributes: Record<string, number> = {
      POSITION: addAccessor(new Float32Array(mesh.positions), 'VEC3', 5126, 34962),
    };
    if (mesh.uvs) attributes['TEXCOORD_0'] = addAccessor(new Float32Array(mesh.uvs), 'VEC2', 5126, 34962);
    const primitive: Record<string, unknown> = { attributes, mode: 4 };
    if (mesh.indices) primitive['indices'] = addAccessor(new Uint32Array(mesh.indices), 'SCALAR', 5125, 34963);
    return { name: mesh.name, primitives: [primitive] };
  });

  const nodes = meshes.map((mesh, index) => ({
    mesh: index,
    name: mesh.name,
    ...(mesh.translation ? { translation: mesh.translation } : {}),
    ...(mesh.scale ? { scale: mesh.scale } : {}),
  }));

  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, index) => index) }],
    nodes,
    meshes: gltfMeshes,
    accessors,
    bufferViews,
    buffers: [{ byteLength: byteOffset, ...(options.externalBufferUri ? { uri: options.externalBufferUri } : {}) }],
  };

  const jsonChunk = padTo4(new TextEncoder().encode(JSON.stringify(json)), 0x20);
  const binChunk = padTo4(
    buffers.reduce((all, bytes) => {
      const merged = new Uint8Array(all.length + bytes.length);
      merged.set(all);
      merged.set(bytes, all.length);
      return merged;
    }, new Uint8Array(0)),
    0,
  );

  const total = 12 + 8 + jsonChunk.length + (binChunk.length > 0 ? 8 + binChunk.length : 0);
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);
  view.setUint32(0, 0x46546c67, true); // 'glTF'
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunk.length, true);
  view.setUint32(16, 0x4e4f534a, true); // 'JSON'
  bytes.set(jsonChunk, 20);
  if (binChunk.length > 0) {
    const binStart = 20 + jsonChunk.length;
    view.setUint32(binStart, binChunk.length, true);
    view.setUint32(binStart + 4, 0x004e4942, true); // 'BIN'
    bytes.set(binChunk, binStart + 8);
  }
  return out;
}
