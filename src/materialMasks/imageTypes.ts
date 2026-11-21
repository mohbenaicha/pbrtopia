/** Interleaved 8-bit pixels: grey (1), RGB (3) or RGBA (4, straight alpha). The one definition the mask core and the PNG codec share (material-masks-core R4). */
export interface PixelImage {
  width: number;
  height: number;
  channels: 1 | 3 | 4;
  data: Uint8Array;
}
