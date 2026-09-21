import { decodeLogo } from '../api/types';

/** JPEG data URI for the embedded logo. Null when absent/corrupt (never throws). */
export function logoDataUrl(base64: string): string | null {
  const bytes = decodeLogo(base64);
  if (!bytes) return null;
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  try {
    return `data:image/jpeg;base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}
