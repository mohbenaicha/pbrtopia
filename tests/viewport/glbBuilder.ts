// Builds small GLB files in memory for the loader tests (no images, so they parse in Node).
export interface GlbOptions {
  positions?: number[]; // xyz triples of one triangle list
  extensionsUsed?: string[];
  extensionsRequired?: string[];
}

const TRIANGLE = [0, 0, 0, 2, 0, 0, 0, 2, 0];

function padTo4(bytes: Uint8Array, filler: number): Uint8Array {
  const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4).fill(filler);
  padded.set(bytes);
  return padded;
}

export function buildGlbFromJsonText(jsonText: string, binary: Uint8Array = new Uint8Array(0)): ArrayBuffer {
  const json = padTo4(new TextEncoder().encode(jsonText), 0x20);
  const bin = padTo4(binary, 0);
  const total = 12 + 8 + json.length + (bin.length > 0 ? 8 + bin.length : 0);
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, json.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20, json.length).set(json);
  if (bin.length > 0) {
    view.setUint32(20 + json.length, bin.length, true);
    view.setUint32(24 + json.length, 0x004e4942, true);
    new Uint8Array(buffer, 28 + json.length, bin.length).set(bin);
  }
  return buffer;
}

// A one-by-one quad whose material uses the first PNG as its colour map and the second as its normal and metal/rough map, so every texture channel is listed.
export function buildTexturedQuadGlb(colourPng: Uint8Array, dataPng: Uint8Array, mimeType: 'image/png' | 'image/jpeg' = 'image/png'): ArrayBuffer {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
  const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const parts = [new Uint8Array(positions.buffer), new Uint8Array(uvs.buffer), new Uint8Array(indices.buffer), padTo4(colourPng, 0), padTo4(dataPng, 0)];
  const binary = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  const offsets = parts.map((_, index) => parts.slice(0, index).reduce((total, part) => total + part.length, 0));
  parts.forEach((part, index) => binary.set(part, offsets[index]!));
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 1 } }, normalTexture: { index: 1 } }],
    textures: [{ source: 0, sampler: 0 }, { source: 1, sampler: 0 }],
    samplers: [{}],
    images: [{ bufferView: 3, mimeType }, { bufferView: 4, mimeType }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5126, count: 4, type: 'VEC2' },
      { bufferView: 2, componentType: 5123, count: 6, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: offsets[0], byteLength: parts[0]!.length },
      { buffer: 0, byteOffset: offsets[1], byteLength: parts[1]!.length },
      { buffer: 0, byteOffset: offsets[2], byteLength: parts[2]!.length },
      { buffer: 0, byteOffset: offsets[3], byteLength: colourPng.length },
      { buffer: 0, byteOffset: offsets[4], byteLength: dataPng.length },
    ],
    buffers: [{ byteLength: binary.length }],
  };
  return buildGlbFromJsonText(JSON.stringify(json), binary);
}

export function buildTriangleGlb(options: GlbOptions = {}): ArrayBuffer {
  const positions = new Float32Array(options.positions ?? TRIANGLE);
  const bytes = new Uint8Array(positions.buffer);
  const vertexCount = positions.length / 3;
  const min = [0, 1, 2].map((axis) => Math.min(...Array.from({ length: vertexCount }, (_, i) => positions[i * 3 + axis]!)));
  const max = [0, 1, 2].map((axis) => Math.max(...Array.from({ length: vertexCount }, (_, i) => positions[i * 3 + axis]!)));
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: vertexCount, type: 'VEC3', min, max }],
    bufferViews: [{ buffer: 0, byteLength: bytes.length }],
    buffers: [{ byteLength: bytes.length }],
    ...(options.extensionsUsed ? { extensionsUsed: options.extensionsUsed } : {}),
    ...(options.extensionsRequired ? { extensionsRequired: options.extensionsRequired } : {}),
  };
  return buildGlbFromJsonText(JSON.stringify(json), bytes);
}
