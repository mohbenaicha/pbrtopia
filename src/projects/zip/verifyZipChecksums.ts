import { readCentralDirectoryChecksums } from './centralDirectory';
import { shorten } from './zipRejection';

const END_RECORD_BYTES = 22; // the end-of-central-directory record of a zip without a comment

/** True when the last bytes are an end-of-central-directory record with an empty comment. */
export function hasEndRecord(tail: Uint8Array): boolean {
  const end = tail.subarray(Math.max(0, tail.length - END_RECORD_BYTES));
  return end.length === END_RECORD_BYTES && end[0] === 0x50 && end[1] === 0x4b && end[2] === 0x05 && end[3] === 0x06 && end[20] === 0 && end[21] === 0;
}

/**
 * The unzipper does not check checksums, so the zip's own record of each entry's CRC-32 is compared with the bytes that were unpacked.
 * Returns the reason the zip is damaged or cut off, or null when every entry matches.
 */
export function findChecksumProblem(unpacked: ReadonlyMap<string, number>, tail: Uint8Array, sourceBytes: number): string | null {
  const recorded = readCentralDirectoryChecksums(tail, sourceBytes);
  if (recorded === null || recorded.length !== unpacked.size) return 'The zip is cut off or incomplete.';
  for (const { name, crc } of recorded) {
    const streamed = unpacked.get(name);
    if (streamed === undefined) return `The zip lists "${shorten(name)}" but does not contain it.`;
    if (streamed !== crc) return `"${shorten(name)}" in the zip is damaged.`;
  }
  return null;
}
