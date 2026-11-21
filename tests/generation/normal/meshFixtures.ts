import type { PixelPicture, UvMesh } from '../../../src/generation/normal/uprightTypes';

export interface QuadOptions {
  centre: [number, number]; // uv of the quad's middle, 0..1, v down
  half: number; // half the side, in uv units (the world side is the same size)
  turnDeg?: number; // clockwise turn of the picture, so world up appears this far from the picture's top
  mirrored?: boolean;
  floor?: boolean; // a horizontal quad: no stable up
  at?: number; // shifts the quad in the world so two quads never share a position
  stretchU?: number; // the picture's u axis is drawn this many times longer than the world (a stretched island)
}

// One quad of two triangles: a wall in the XY plane facing +Z (world up = +Y), or a floor in the XZ plane. Image y runs down.
export function quadMesh(o: QuadOptions): UvMesh {
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const alpha = ((o.turnDeg ?? 0) * Math.PI) / 180;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (const [cx, cy] of corners) {
    const x = cx * o.half;
    const y = cy * o.half;
    const ix = o.mirrored ? -x : x;
    const iy = -y; // world up is the top of the picture before the turn
    const rx = ix * Math.cos(alpha) - iy * Math.sin(alpha);
    const ry = ix * Math.sin(alpha) + iy * Math.cos(alpha);
    positions.push(...(o.floor ? [x + (o.at ?? 0) * 100, 0, y] : [x + (o.at ?? 0) * 100, y, 0]));
    uvs.push(o.centre[0] + rx * (o.stretchU ?? 1), o.centre[1] + ry);
  }
  return { positions: new Float32Array(positions), uvs: new Float32Array(uvs), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) };
}

export function joinMeshes(...meshes: UvMesh[]): UvMesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const mesh of meshes) {
    const base = positions.length / 3;
    positions.push(...mesh.positions);
    uvs.push(...mesh.uvs);
    indices.push(...Array.from(mesh.indices, (i) => i + base));
  }
  return { positions: new Float32Array(positions), uvs: new Float32Array(uvs), indices: new Uint32Array(indices) };
}

export function solidPicture(side: number, rgb: [number, number, number]): PixelPicture {
  const rgba = new Uint8ClampedArray(side * side * 4);
  for (let i = 0; i < side * side; i += 1) rgba.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
  return { side, rgba };
}

export function pixelAt(picture: PixelPicture, x: number, y: number): [number, number, number] {
  const o = (y * picture.side + x) * 4;
  return [picture.rgba[o]!, picture.rgba[o + 1]!, picture.rgba[o + 2]!];
}

// The tilt of a stored normal texel from straight out, in degrees, and its direction (x right, y up).
export function decodeNormal(picture: PixelPicture, x: number, y: number): { x: number; y: number; z: number } {
  const [r, g, b] = pixelAt(picture, x, y);
  return { x: (r / 255) * 2 - 1, y: (g / 255) * 2 - 1, z: (b / 255) * 2 - 1 };
}

export function angleBetweenDeg(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const la = Math.hypot(a.x, a.y, a.z);
  const lb = Math.hypot(b.x, b.y, b.z);
  const cos = Math.min(1, Math.max(-1, (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb)));
  return (Math.acos(cos) * 180) / Math.PI;
}
