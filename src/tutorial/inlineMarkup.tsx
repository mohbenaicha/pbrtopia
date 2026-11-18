import type { ReactNode } from 'react';

// A marked run starts and ends on a non-space, so "2 * 3 * 4" is not italic. A link is `[text](key)`.
const MARKED = /(\*\*[^*\s](?:[^*]*[^*\s])?\*\*|\*[^*\s](?:[^*]*[^*\s])?\*|\[[^\]\n]+\]\([a-z-]+\))/g;
const LINK = /^\[([^\]\n]+)\]\(([a-z-]+)\)$/;

/**
 * A paragraph of the words as React nodes: `**bold**` is strong, `*italic*` is em, `[text](key)` is a link to `links[key]`, everything else is plain text. A key the
 * caller does not give leaves only the text, so a words file can never put an address of its own in the page. Never HTML (tutorial R9, R20).
 */
export function renderInlineMarkup(paragraph: string, links: Readonly<Record<string, string>> = {}): ReactNode[] {
  return paragraph.split(MARKED).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={index}>{part.slice(1, -1)}</em>;
    const link = LINK.exec(part);
    if (link !== null) {
      const href = links[link[2]!];
      return href === undefined ? link[1] : <a key={index} href={href} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    }
    return part;
  });
}
