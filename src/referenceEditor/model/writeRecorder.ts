/** Told about every rectangle an operation is about to write, so history can keep the old tiles. Called BEFORE the write. */
export interface WriteRecorder {
  touchRaster(x: number, y: number, w: number, h: number): void;
  touchMask(x: number, y: number, w: number, h: number): void;
}

export const NO_RECORDER: WriteRecorder = { touchRaster: () => undefined, touchMask: () => undefined };
