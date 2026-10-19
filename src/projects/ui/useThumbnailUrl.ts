import { useEffect, useState } from 'react';

// A web address for one project's stored thumbnail, or null when it has none. The address is released when the card goes away.
export function useThumbnailUrl(loadThumbnail: (projectId: string) => Promise<Blob | null>, projectId: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    void loadThumbnail(projectId).then((blob) => {
      if (cancelled || blob === null) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      cancelled = true;
      if (made !== null) URL.revokeObjectURL(made);
    };
  }, [loadThumbnail, projectId]);

  return url;
}
