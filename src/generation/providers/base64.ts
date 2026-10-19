const CHUNK = 0x8000;

// R7, R8: the bytes of a blob as base64, built in chunks so a multi-megabyte image does not overflow the call stack.
export async function encodeBlobBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let start = 0; start < bytes.length; start += CHUNK) binary += String.fromCharCode(...bytes.subarray(start, start + CHUNK));
  return btoa(binary);
}

export interface EncodedImage {
  mimeType: string;
  base64: string;
}

// R7, R8: an image blob as its type and base64 (a blob with no type is sent as a PNG).
export async function encodeImage(blob: Blob): Promise<EncodedImage> {
  return { mimeType: blob.type === '' ? 'image/png' : blob.type, base64: await encodeBlobBase64(blob) };
}

// R7: a base64 image answer as a blob of the given type.
export function decodeBase64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}
