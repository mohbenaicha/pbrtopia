import { describe, expect, it } from 'vitest';
import { isSafeBlobKey } from '../../src/projects';
import { caseCollisionWith, escapeKeyPath, escapeSegment, unescapeKeyPath, unescapeSegment } from '../../src/storage-desktop/pathEscape';

const ILLEGAL_ON_WINDOWS = /[<>:"|?*\\\u0000-\u001f]/;
const DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** What Windows refuses in one path segment, checked on an escaped one. */
function isLegalWindowsSegment(segment: string): boolean {
  return segment !== '' && !ILLEGAL_ON_WINDOWS.test(segment) && !/[. ]$/.test(segment) && !DEVICE_NAME.test(segment.split('.')[0]!) && !/\.tmp$/i.test(segment);
}

const NASTY_KEYS = [
  'textures/Body-albedo.png',
  'a:b',
  'a<b>c"d|e?f*g',
  'trailing dot./x',
  'x/trailing space /y',
  'x/both. . ',
  'CON',
  'nul.txt',
  'Com1',
  'dir/LPT9.x.y',
  'aux.',
  'conx',
  'COM0',
  'a/b.tmp',
  'a/B.TMP',
  'note.tmp.png',
  '100%',
  '100%25',
  'a%41',
  '%',
  'tab\there',
  'ctl\u0001\u001fend',
  'ünïcödé/日本語/😀.png',
  '.hidden',
  'a..b',
  ' leading space',
  'Z:',
  'x/y:z',
];

describe('escapeKeyPath (storage-backends R6)', () => {
  it('R6 a plain key is unchanged', () => {
    expect(escapeKeyPath('textures/Body-albedo.png')).toBe('textures/Body-albedo.png');
    expect(escapeKeyPath('ünïcödé/日本語/😀.png')).toBe('ünïcödé/日本語/😀.png');
  });

  it('R6 each character Windows refuses becomes %XX with upper-case hex', () => {
    expect(escapeSegment('a<b>c"d|e?f*g:h')).toBe('a%3Cb%3Ec%22d%7Ce%3Ff%2Ag%3Ah');
    expect(escapeSegment('ctl\u0001\u001fend')).toBe('ctl%01%1Fend');
  });

  it('R6 the escape character itself is escaped, so a literal %41 is not read back as a capital A', () => {
    expect(escapeSegment('a%41')).toBe('a%2541');
    expect(unescapeSegment(escapeSegment('a%41'))).toBe('a%41');
  });

  it('R6 trailing dots and spaces are escaped, since Windows drops them', () => {
    expect(escapeSegment('name.')).toBe('name%2E');
    expect(escapeSegment('name ')).toBe('name%20');
    expect(escapeSegment('both. . ')).toBe('both%2E%20%2E%20');
    expect(escapeSegment('a.b')).toBe('a.b');
  });

  it('R6 a device name, with or without an extension and in any case, has its first letter escaped', () => {
    expect(escapeSegment('CON')).toBe('%43ON');
    expect(escapeSegment('nul.txt')).toBe('%6Eul.txt');
    expect(escapeSegment('Com1')).toBe('%43om1');
    expect(escapeSegment('LPT9.x.y')).toBe('%4CPT9.x.y');
    expect(escapeSegment('conx')).toBe('conx');
    expect(escapeSegment('COM0')).toBe('COM0');
  });

  it('R6 a name ending in .tmp is escaped so the temporary files of a write never clash with a stored file', () => {
    expect(escapeSegment('a.tmp')).toBe('a%2Etmp');
    expect(escapeSegment('a.TMP')).toBe('a%2ETMP');
    expect(escapeSegment('note.tmp.png')).toBe('note.tmp.png');
  });

  it('R6 every key the app accepts maps to a path made only of legal Windows segments', () => {
    for (const key of NASTY_KEYS.filter(isSafeBlobKey)) {
      for (const segment of escapeKeyPath(key).split('/')) expect(isLegalWindowsSegment(segment), `${JSON.stringify(key)} -> ${segment}`).toBe(true);
    }
  });

  it('R6 the original key comes back from the escaped path', () => {
    for (const key of NASTY_KEYS.filter(isSafeBlobKey)) expect(unescapeKeyPath(escapeKeyPath(key))).toBe(key);
  });

  it('R6 different keys never share a path', () => {
    const keys = NASTY_KEYS.filter(isSafeBlobKey);
    expect(new Set(keys.map(escapeKeyPath)).size).toBe(keys.length);
  });

  it('R6 holds for generated keys too', () => {
    let seed = 12345;
    const next = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648);
    const alphabet = ['a', 'B', '.', ' ', '%', ':', '<', '*', '/', 'C', 'O', 'N', '1', '\t', 't', 'm', 'p', 'é'];
    const seen = new Map<string, string>();
    for (let i = 0; i < 3000; i += 1) {
      const key = Array.from({ length: 1 + (next() % 12) }, () => alphabet[next() % alphabet.length]!).join('');
      if (!isSafeBlobKey(key)) continue;
      const escaped = escapeKeyPath(key);
      expect(unescapeKeyPath(escaped)).toBe(key);
      for (const segment of escaped.split('/')) expect(isLegalWindowsSegment(segment), `${JSON.stringify(key)} -> ${segment}`).toBe(true);
      expect(seen.get(escaped) ?? key).toBe(key);
      seen.set(escaped, key);
    }
  });

  it('R6 a name on disk that this app did not write, with a stray % or a bad escape, is read as it stands', () => {
    expect(unescapeSegment('100%.png')).toBe('100%.png');
    expect(unescapeSegment('50%zz')).toBe('50%zz');
    expect(unescapeSegment('%4')).toBe('%4');
  });
});

describe('caseCollisionWith (storage-backends R6)', () => {
  it('R6 names that differ only in capitals collide: the existing one is returned', () => {
    expect(caseCollisionWith(['Body.png', 'other.png'], 'body.PNG')).toBe('Body.png');
  });

  it('R6 the same name is not a collision (writing a file again replaces it), nor is a different name', () => {
    expect(caseCollisionWith(['Body.png'], 'Body.png')).toBeNull();
    expect(caseCollisionWith(['Body.png'], 'Body2.png')).toBeNull();
    expect(caseCollisionWith([], 'Body.png')).toBeNull();
  });
});
