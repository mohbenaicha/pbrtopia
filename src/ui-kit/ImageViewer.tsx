import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { FITTED_IMAGE_VIEW, panImageBy, zoomImageAt, type ImageView, type PixelSize } from './imageView';
import './ImageViewer.css';

interface ImageViewerProps {
  title: string;
  src: string | null; // null while the picture is being read
  failed?: boolean; // the picture could not be read
  details?: string[]; // lines under the picture: size, colour space
  onDownload?: () => void;
  downloadLabel?: string; // the accessible name of the Download button ("Download Body albedo")
  onClose: () => void;
}

// Viewport-layout R33: the one large viewer for any picture. Wheel zooms toward the pointer, a drag pans, a double-click fits it again; Download and Close are at the top right.
export function ImageViewer({ title, src, failed = false, details = [], onDownload, downloadLabel = 'Download', onClose }: ImageViewerProps): React.JSX.Element {
  const frame = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLImageElement>(null);
  const [view, setView] = useState<ImageView>(FITTED_IMAGE_VIEW);

  // What the zoom maths needs, read when a wheel turns or a drag moves (a picture that has no size yet cannot be zoomed).
  const measure = (): { image: PixelSize; area: PixelSize; rect: DOMRect } | null => {
    const element = frame.current;
    const image = picture.current;
    if (!element || !image || image.naturalWidth === 0) return null;
    const rect = element.getBoundingClientRect();
    return { image: { width: image.naturalWidth, height: image.naturalHeight }, area: { width: rect.width, height: rect.height }, rect };
  };

  useEffect(() => {
    const element = frame.current;
    if (!element) return undefined;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault(); // the page behind never scrolls, and the wheel is this viewer's
      const sizes = measure();
      if (sizes === null) return;
      const pointer = { x: event.clientX - sizes.rect.left - sizes.rect.width / 2, y: event.clientY - sizes.rect.top - sizes.rect.height / 2 };
      setView((current) => zoomImageAt(current, event.deltaY, event.deltaMode, pointer, sizes.image, sizes.area));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  const startDrag = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.preventDefault(); // no text or picture selection while dragging
    const start = { x: event.clientX, y: event.clientY, view };
    const move = (next: MouseEvent): void => {
      const sizes = measure();
      if (sizes !== null) setView(panImageBy(start.view, next.clientX - start.x, next.clientY - start.y, sizes.image, sizes.area));
    };
    const stop = (): void => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', stop);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', stop);
  };

  return (
    <Dialog
      open
      size="large"
      title={title}
      onClose={onClose}
      headerActions={
        <>
          {onDownload !== undefined && <IconButton label={downloadLabel} icon={<Icon name="download" />} onClick={onDownload} />}
          <IconButton label="Close" icon={<Icon name="close" />} onClick={onClose} />
        </>
      }
    >
      <div className="ui-image-viewer__frame" data-testid="image-viewer-frame" data-zoomed={view.zoom > 1 ? '' : undefined} ref={frame} onMouseDown={startDrag} onDoubleClick={() => setView(FITTED_IMAGE_VIEW)}>
        {src !== null && <img className="ui-image-viewer__picture" ref={picture} src={src} alt={title} draggable={false} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }} />}
        {failed && <span className="ui-image-viewer__failed">Preview unavailable</span>}
      </div>
      {details.length > 0 && (
        <div className="ui-image-viewer__details">
          {details.map((line) => <span key={line}>{line}</span>)}
        </div>
      )}
    </Dialog>
  );
}
