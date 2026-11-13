// Storage-backends R6: a file key that is legal in the browser becomes a path that is legal on Windows, and comes back unchanged.
// Each `/`-separated segment is escaped on its own; a character is written as `%` and two upper-case hex digits.

const ESCAPE_CHARACTER = /[%<>:"|?*\\\u0000-\u001f]/g; // `%` itself too, so an escape is never confused with text
const TRAILING_DOTS_AND_SPACES = /[. ]+$/; // Windows drops them
const TEMPORARY_SUFFIX = /\.(tmp)$/i; // the temporary files of a write end in .tmp, so a stored file never may
const DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const ESCAPED = /%([0-9A-F]{2})/g;

const escapeCode = (character: string): string => `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`;

/** One path segment of a key, safe to use as a Windows file or folder name. */
export function escapeSegment(segment: string): string {
  let escaped = segment.replace(ESCAPE_CHARACTER, escapeCode);
  escaped = escaped.replace(TRAILING_DOTS_AND_SPACES, (run) => Array.from(run, escapeCode).join(''));
  escaped = escaped.replace(TEMPORARY_SUFFIX, '%2E$1');
  const stem = escaped.split('.')[0]!.trimEnd(); // `CON.txt` and `CON .txt` both name the device
  return DEVICE_NAME.test(stem) ? escapeCode(escaped) + escaped.slice(1) : escaped;
}

/** The segment a key had before `escapeSegment`. A `%` that does not start a valid escape is left as it is (a name this app did not write). */
export const unescapeSegment = (segment: string): string => segment.replace(ESCAPED, (_whole, hex: string) => String.fromCharCode(parseInt(hex, 16)));

/** The relative path on disk for a blob key (`/`-separated, every segment escaped). */
export const escapeKeyPath = (key: string): string => key.split('/').map(escapeSegment).join('/');

/** The blob key for a relative path on disk made by `escapeKeyPath`. */
export const unescapeKeyPath = (path: string): string => path.split('/').map(unescapeSegment).join('/');

/**
 * Windows names compare without regard to capitals, so two keys that differ only in them cannot both be files in one folder:
 * the name in `names` that `candidate` would collide with, or null (the same name again is a rewrite, not a collision).
 */
export function caseCollisionWith(names: readonly string[], candidate: string): string | null {
  const lower = candidate.toLowerCase();
  return names.find((name) => name !== candidate && name.toLowerCase() === lower) ?? null;
}
