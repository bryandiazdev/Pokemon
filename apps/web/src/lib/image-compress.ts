/**
 * Client-side image compression for grade uploads. Keeps multipart payloads
 * under typical serverless body limits while preserving enough detail for CV.
 */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export async function compressImageFile(
  file: File,
  opts: { maxEdge?: number; quality?: number } = {},
): Promise<File> {
  const maxEdge = opts.maxEdge ?? MAX_EDGE;
  const quality = opts.quality ?? JPEG_QUALITY;

  // Already small enough — skip the canvas pass.
  if (file.size <= 400_000 && file.type === 'image/jpeg') return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob) return file;

  const base = file.name.replace(/\.[^.]+$/, '') || 'capture';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}
