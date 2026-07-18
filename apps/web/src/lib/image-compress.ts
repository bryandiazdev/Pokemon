/**
 * Client-side image compression for grade uploads. Keeps multipart payloads
 * under typical serverless body limits while preserving enough detail for CV.
 */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Recompress a set of files until their combined size fits a byte budget
 * (serverless request bodies cap out around 4.5 MB). Steps down the largest
 * files first so sharp captures keep as much detail as the budget allows.
 */
export async function fitFilesToBudget(files: File[], budgetBytes: number): Promise<File[]> {
  const steps = [
    { maxEdge: 2000, quality: 0.85 },
    { maxEdge: 1700, quality: 0.8 },
    { maxEdge: 1400, quality: 0.75 },
  ];
  const out = [...files];
  const level = new Array<number>(out.length).fill(-1);

  let total = out.reduce((n, f) => n + f.size, 0);
  while (total > budgetBytes) {
    // Largest file that can still step down.
    let idx = -1;
    for (let i = 0; i < out.length; i++) {
      if (level[i]! >= steps.length - 1) continue;
      if (idx === -1 || out[i]!.size > out[idx]!.size) idx = i;
    }
    if (idx === -1) break; // everything at minimum — send as-is
    level[idx] = level[idx]! + 1;
    const step = steps[level[idx]!]!;
    const smaller = await compressImageFile(out[idx]!, step);
    // Guard against a no-op (already-small jpeg passthrough).
    if (smaller.size >= out[idx]!.size) {
      level[idx] = steps.length - 1;
      continue;
    }
    out[idx] = smaller;
    total = out.reduce((n, f) => n + f.size, 0);
  }
  return out;
}

export async function compressImageFile(
  file: File,
  opts: { maxEdge?: number; quality?: number } = {},
): Promise<File> {
  const maxEdge = opts.maxEdge ?? MAX_EDGE;
  const quality = opts.quality ?? JPEG_QUALITY;

  // Already small enough — skip the canvas pass.
  if (file.size <= 400_000 && file.type === 'image/jpeg') return file;

  // Bake EXIF rotation in — library photos are often stored rotated, and a
  // sideways card wrecks both OCR and vision reads.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
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
