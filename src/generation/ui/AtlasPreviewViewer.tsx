import { ImageViewer, saveBlobAsFile } from '../../ui-kit';
import { useObjectUrl } from './useObjectUrl';

interface AtlasPreviewViewerProps {
  png: Blob;
  onClose: () => void;
}

// R38: the atlas a run with the panel's settings would send, in the shared large image viewer.
export function AtlasPreviewViewer({ png, onClose }: AtlasPreviewViewerProps): React.JSX.Element {
  const url = useObjectUrl(png);
  return <ImageViewer title="Atlas preview" src={url} downloadLabel="Download atlas preview" onDownload={() => saveBlobAsFile(png, 'atlas.png')} onClose={onClose} />;
}
