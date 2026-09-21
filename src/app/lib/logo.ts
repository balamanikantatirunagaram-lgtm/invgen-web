/**
 * Company logo picker: downscale + JPEG-encode to base64 for embedding in
 * the company row (`logo_base64`, ~100KB cap). Mirrors mobile LogoService
 * intent: small enough to sync everywhere, prints on invoices.
 * Browser-only (canvas); no unit tests — exercised manually.
 */

const MAX_DIM = 512;
const MAX_BYTES = 100 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image. Try a PNG or JPEG.'));
    };
    img.src = url;
  });
}

/**
 * Downscale the picked image and return raw base64 (no data: prefix).
 * Throws a user-safe Error on failure.
 */
export async function pickAndEncodeLogo(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Pick a PNG or JPEG image.');
  }
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing is not available in this browser.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  let quality = 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length * 0.75 > MAX_BYTES && quality > 0.4) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  const marker = ';base64,';
  const idx = dataUrl.indexOf(marker);
  if (idx < 0) throw new Error('Could not encode that image.');
  return dataUrl.slice(idx + marker.length);
}
