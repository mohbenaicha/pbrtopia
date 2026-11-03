import { readGlb, writeGlb } from './glbContainer';

export interface SourceImage {
  mimeType: 'image/png' | 'image/jpeg';
  bytes: Uint8Array;
}

interface ImageDef {
  bufferView?: number;
  uri?: string;
  mimeType?: string;
}
interface BufferViewDef {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
}

const KEPT_TYPES = ['image/png', 'image/jpeg'] as const;
const isKeptType = (type: string | undefined): type is SourceImage['mimeType'] => (KEPT_TYPES as readonly (string | undefined)[]).includes(type);

function decodeDataUri(uri: string): SourceImage | null {
  const match = /^data:(image\/[a-z]+);base64,(.*)$/s.exec(uri);
  if (!match || !isKeptType(match[1])) return null;
  try {
    return { mimeType: match[1], bytes: Uint8Array.from(atob(match[2]!), (char) => char.charCodeAt(0)) };
  } catch {
    return null;
  }
}

/** R25: the PNG and JPEG images a GLB holds itself (in its binary chunk or as a data URI), by image index; others are left out. Each image's bytes are a copy. */
export function readSourceImages(glb: ArrayBuffer): Map<number, SourceImage> {
  const found = new Map<number, SourceImage>();
  const parts = readGlb(glb);
  const images = parts?.json['images'];
  if (parts === null || !Array.isArray(images)) return found;
  const views = (parts.json['bufferViews'] ?? []) as BufferViewDef[];
  (images as ImageDef[]).forEach((image, index) => {
    if (image.bufferView !== undefined) {
      const view = views[image.bufferView];
      if (!view || view.buffer !== 0 || parts.bin === null || !isKeptType(image.mimeType)) return;
      const start = view.byteOffset ?? 0;
      if (start + view.byteLength > parts.bin.length) return;
      found.set(index, { mimeType: image.mimeType, bytes: parts.bin.slice(start, start + view.byteLength) });
    } else if (image.uri?.startsWith('data:')) {
      const decoded = decodeDataUri(image.uri);
      if (decoded) found.set(index, decoded);
    }
  });
  return found;
}

/**
 * R25: the GLB with the bytes and type of the listed images replaced (image index of `glb` -> picture), everything else kept. The binary chunk is
 * laid out again so each buffer view starts on a multiple of 4. Null when the file is not shaped the way an export is (the caller then does not use it).
 */
export function replaceImages(glb: ArrayBuffer, replacements: ReadonlyMap<number, SourceImage>): ArrayBuffer | null {
  const parts = readGlb(glb);
  if (parts === null || parts.bin === null) return null;
  const { json, bin } = parts;
  const views = json['bufferViews'] as BufferViewDef[] | undefined;
  const images = json['images'] as ImageDef[] | undefined;
  const buffers = json['buffers'] as { byteLength: number }[] | undefined;
  if (!views || !images || !buffers || buffers.length !== 1) return null;

  const pictureOfView = new Map<number, SourceImage>();
  for (const [index, picture] of replacements) {
    const image = images[index];
    if (image?.bufferView === undefined || views[image.bufferView] === undefined) return null;
    pictureOfView.set(image.bufferView, picture);
    image.mimeType = picture.mimeType;
  }

  const order = views.map((_, index) => index).sort((a, b) => (views[a]!.byteOffset ?? 0) - (views[b]!.byteOffset ?? 0));
  const placed: { offset: number; data: Uint8Array }[] = [];
  let offset = 0;
  for (const index of order) {
    const view = views[index]!;
    if (view.buffer !== 0) return null;
    const start = view.byteOffset ?? 0;
    if (start + view.byteLength > bin.length) return null;
    const data = pictureOfView.get(index)?.bytes ?? bin.subarray(start, start + view.byteLength);
    offset = Math.ceil(offset / 4) * 4;
    view.byteOffset = offset;
    view.byteLength = data.length;
    placed.push({ offset, data });
    offset += data.length;
  }
  const out = new Uint8Array(Math.ceil(offset / 4) * 4);
  for (const { offset: at, data } of placed) out.set(data, at);
  buffers[0]!.byteLength = out.length;
  return writeGlb(json, out);
}
