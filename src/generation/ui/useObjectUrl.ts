import { useEffect, useState } from 'react';

// An address for a picture held as a Blob, made when the Blob arrives and let go of when it changes or the owner unmounts. null until it is made.
export function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (blob === null) {
      setUrl(null);
      return undefined;
    }
    const made = URL.createObjectURL(blob);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [blob]);
  return url;
}
