import { useEffect, useState } from 'react';
import './AtlasPreview.css';

interface AtlasPreviewProps {
  atlas: Blob | null;
}

// R10: the composite atlas (the grid of view tiles) docked in the viewport while a run goes; nothing when there is no atlas yet.
export function AtlasPreview({ atlas }: AtlasPreviewProps): React.JSX.Element | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (atlas === null) {
      setUrl(null);
      return;
    }
    const made = URL.createObjectURL(atlas);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [atlas]);
  if (atlas === null || url === null) return null;
  return (
    <figure className="atlas-preview" data-testid="atlas-preview">
      <img src={url} alt="Captured views sent to the image model" />
    </figure>
  );
}
