import { unzlibSync, zlibSync } from 'fflate';
import { PNG_SIGNATURE, PngError, readChunks, writeChunk } from './pngChunks';
import { applyFilters, removeFilters } from './pngFilters';

export { PngError };

// 8-bit RGB, RGBA, grey and indexed PNG files (maps R58, R59); wider and narrower sources are reduced to 8 bits on decode (R35).

/** Interleaved 8-bit pixels: grey (1), RGB (3) or RGBA (4, straight alpha). */
export interface PixelImage {
  width: number;
  height: number;
  channels: 1 | 3 | 4;
  data: Uint8Array;
}

/** An 8-bit image of palette indices; `palette` is RGB triplets. */
export interface IndexedImage {
  width: number;
  height: number;
  palette: Uint8Array;
  indices: Uint8Array;
}

export type DecodedPng = PixelImage | IndexedImage;

export function isIndexedImage(image: DecodedPng): image is IndexedImage {
  return 'palette' in image;
}

function header(width: number, height: number, colorType: number): Uint8Array {
  const bytes = new Uint8Array(13);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  bytes.set([8, colorType, 0, 0, 0], 8);
  return bytes;
}

function join(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const COLOR_TYPE_OF_CHANNELS = { 1: 0, 3: 2, 4: 6 } as const;

/** R58: colour type 0 (grey), 2 (RGB), 3 (indexed) or 6 (RGBA), 8 bits per channel. */
export function encodePng(image: DecodedPng): Uint8Array {
  const indexed = isIndexedImage(image);
  const channels = indexed ? 1 : image.channels;
  const colorType = indexed ? 3 : COLOR_TYPE_OF_CHANNELS[channels];
  const raw = indexed ? image.indices : image.data;
  const filtered = applyFilters(raw, image.width * channels, image.height, channels);
  const parts = [PNG_SIGNATURE, writeChunk('IHDR', header(image.width, image.height, colorType))];
  if (indexed) parts.push(writeChunk('PLTE', image.palette));
  parts.push(writeChunk('IDAT', zlibSync(filtered)), writeChunk('IEND', new Uint8Array()));
  return join(parts);
}

const SAMPLES_PER_PIXEL: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Samples of every row as bytes: 1, 2 and 4 bit samples scaled to 0-255 (kept as indices for a palette), 16-bit samples cut to their high byte. */
function toBytes(rows: Uint8Array, rowBytes: number, height: number, perRow: number, bitDepth: number, keepIndex: boolean): Uint8Array {
  const out = new Uint8Array(perRow * height);
  const perByte = 8 / bitDepth;
  for (let y = 0; y < height; y += 1) {
    const row = rows.subarray(y * rowBytes, (y + 1) * rowBytes);
    for (let i = 0; i < perRow; i += 1) {
      if (bitDepth === 8) out[y * perRow + i] = row[i]!;
      else if (bitDepth === 16) out[y * perRow + i] = row[i * 2]!;
      else {
        const value = (row[Math.floor(i / perByte)]! >> (8 - bitDepth * ((i % perByte) + 1))) & ((1 << bitDepth) - 1);
        out[y * perRow + i] = keepIndex ? value : Math.round((value * 255) / ((1 << bitDepth) - 1));
      }
    }
  }
  return out;
}

/** The header names a side over the limit the caller set (maps R38): nothing was inflated. */
export class PngTooLargeError extends PngError {}

/**
 * R35, R59, R61: any non-interlaced PNG; throws PngError for a damaged, cut-short, interlaced or unsupported file.
 * With `maxSide`, a header naming a longer side throws PngTooLargeError before any pixel data is read (R38).
 */
export function decodePng(bytes: Uint8Array, maxSide = Number.POSITIVE_INFINITY): DecodedPng {
  const chunks = readChunks(bytes);
  const head = chunks.find((chunk) => chunk.type === 'IHDR')?.data;
  if (!head || head.length < 13) throw new PngError('The PNG file has no header.');
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  const width = view.getUint32(0);
  const height = view.getUint32(4);
  const bitDepth = head[8]!;
  const colorType = head[9]!;
  if (Math.max(width, height) > maxSide) throw new PngTooLargeError('Image too large');
  if (head[12] !== 0) throw new PngError('Interlaced PNG files are not supported.');
  const samples = SAMPLES_PER_PIXEL[colorType];
  if (!samples || ![1, 2, 4, 8, 16].includes(bitDepth) || width === 0 || height === 0) throw new PngError('This PNG format is not supported.');
  const rowBytes = Math.ceil((width * samples * bitDepth) / 8);
  let filtered: Uint8Array;
  try {
    filtered = unzlibSync(join(chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data)));
  } catch {
    throw new PngError('The PNG pixel data is damaged.');
  }
  if (filtered.length < (rowBytes + 1) * height) throw new PngError('The PNG pixel data is too short.');
  let rows: Uint8Array;
  try {
    rows = removeFilters(filtered, rowBytes, height, Math.max(1, (samples * bitDepth) >> 3));
  } catch {
    throw new PngError('The PNG pixel data is damaged.');
  }
  if (colorType === 3) {
    const palette = chunks.find((chunk) => chunk.type === 'PLTE')?.data;
    if (!palette || palette.length < 3) throw new PngError('The PNG palette is missing.');
    return { width, height, palette: Uint8Array.from(palette), indices: toBytes(rows, rowBytes, height, width, bitDepth, true) };
  }
  const values = toBytes(rows, rowBytes, height, width * samples, bitDepth, false);
  if (colorType === 4) {
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i += 1) rgba.set([values[i * 2]!, values[i * 2]!, values[i * 2]!, values[i * 2 + 1]!], i * 4);
    return { width, height, channels: 4, data: rgba };
  }
  return { width, height, channels: samples as 1 | 3 | 4, data: values };
}

/** An indexed image as RGB pixels; an index past the palette is black. */
export function expandIndexed(image: IndexedImage): PixelImage {
  const data = new Uint8Array(image.indices.length * 3);
  image.indices.forEach((index, i) => {
    data[i * 3] = image.palette[index * 3] ?? 0;
    data[i * 3 + 1] = image.palette[index * 3 + 1] ?? 0;
    data[i * 3 + 2] = image.palette[index * 3 + 2] ?? 0;
  });
  return { width: image.width, height: image.height, channels: 3, data };
}
