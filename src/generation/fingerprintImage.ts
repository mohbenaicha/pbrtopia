/** R41: the SHA-256 of the picture's bytes, in lowercase hex; two pictures with the same bytes have the same fingerprint. */
export async function fingerprintImage(image: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await image.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
