import type { CSSProperties } from 'react';
import openProjectUrl from './icons/open-project.png';
import orthographicUrl from './icons/orthographic.png';
import perspectiveUrl from './icons/perspective.png';
import { LINE_ICON_PATHS, type LineIconName } from './lineIcons';
import './Icon.css';

// Icons the user supplied as images (R3). They are drawn as a mask so the token colour tints them and hover and disabled states apply.
const IMAGE_ICON_URLS = {
  perspective: perspectiveUrl,
  orthographic: orthographicUrl,
  'open-project': openProjectUrl,
} as const;

export type ImageIconName = keyof typeof IMAGE_ICON_URLS;
export type IconName = ImageIconName | LineIconName;

const isImageIcon = (name: IconName): name is ImageIconName => name in IMAGE_ICON_URLS;

// Decorative: the control that holds an icon carries the accessible name.
export function Icon({ name, size = 18 }: { name: IconName; size?: number }): React.JSX.Element {
  if (isImageIcon(name)) {
    const style = { '--icon-url': `url(${IMAGE_ICON_URLS[name]})`, '--icon-size': `${size}px` } as CSSProperties;
    return <span className="ui-icon ui-icon--image" data-icon={name} aria-hidden="true" style={style} />;
  }
  return (
    <span className="ui-icon" data-icon={name} aria-hidden="true" style={{ '--icon-size': `${size}px` } as CSSProperties}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        {LINE_ICON_PATHS[name].map((path) => (
          <path key={path} d={path} />
        ))}
      </svg>
    </span>
  );
}
