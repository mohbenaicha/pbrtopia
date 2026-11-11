import { useEffect, useState } from 'react';
import { Button, ImageViewer } from '@shared/ui-kit';
import { kindLabel, type MapsState } from '@mat/maps';
import { isFlatView, type FlatView, type PreviewShading } from '../math/flatViews';
import './openImageButton.css';

interface OpenImageButtonProps {
  shading: PreviewShading;
  mapsState: MapsState;
  readBlob: (key: string) => Promise<Blob | null>;
}

function PictureViewer({ view, workingKey, size, readBlob, onClose }: { view: FlatView; workingKey: string; size: number | null; readBlob: OpenImageButtonProps['readBlob']; onClose: () => void }): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let stale = false;
    void readBlob(workingKey)
      .catch(() => null) // a read that fails is the same as a file that is gone
      .then((blob) => {
        if (stale) return;
        if (blob === null) setFailed(true);
        else {
          url = URL.createObjectURL(blob);
          setSrc(url);
        }
      });
    return () => {
      stale = true;
      if (url !== null) URL.revokeObjectURL(url); // R56: the picture is released when the viewer closes
    };
  }, [readBlob, workingKey]);

  const details = [...(size === null ? [] : [`${size} x ${size}`]), view === 'albedo' ? 'sRGB colour space' : 'Linear colour space'];
  return <ImageViewer title={kindLabel(view, 'albedo')} src={src} failed={failed} details={details} onClose={onClose} />;
}

/** Preview R55: in a flat view, opens the large image viewer on that map's working copy (name, size, colour space). Not offered in the Shaded view; the compare viewer stays on the slot card. */
export function OpenImageButton({ shading, mapsState, readBlob }: OpenImageButtonProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const flat = isFlatView(shading);

  useEffect(() => {
    if (!flat) setOpen(false); // the viewer belongs to the flat view it was opened from
  }, [flat]);

  if (!isFlatView(shading)) return null;
  const record = mapsState.maps[shading];
  const missing = `The material has no ${kindLabel(shading, 'albedo')} map.`;
  return (
    <div className="open-image">
      {record === undefined && <span className="open-image__reason">{missing}</span>}
      <Button disabled={record === undefined} {...(record === undefined ? { title: missing } : {})} onClick={() => setOpen(true)}>
        Open image
      </Button>
      {open && record !== undefined && <PictureViewer view={shading} workingKey={record.workingKey} size={mapsState.size} readBlob={readBlob} onClose={() => setOpen(false)} />}
    </div>
  );
}
