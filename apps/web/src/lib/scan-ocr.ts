/**
 * On-device OCR for the quick-scan flow (tesseract.js v5).
 *
 * Raw Tesseract on a full card photo fails on stylized names over holo foil.
 * This module improves the odds substantially:
 *  - crops the photo into a NAME band (top) and a NUMBER band (bottom) and
 *    runs a targeted pass on each,
 *  - upscales + grayscales + contrast-stretches each band first,
 *  - whitelists collector-number characters on the number pass,
 *  - filters OCR lines by confidence before picking a name.
 *
 * These hints remain best-effort: when the server has OpenAI vision configured
 * it re-reads the photo itself, so a failed device pass no longer kills the
 * scan. The pure text-parsing helpers are exported for unit tests.
 */

export interface OcrLine {
  text: string;
  confidence: number; // 0..100 (Tesseract convention)
  /** Vertical position of the line's top edge, in source pixels. */
  y: number;
}

export interface CardOcrResult {
  name?: string;
  number?: string;
  rawText: string;
}

export interface QualityMetrics {
  /** Mean luma, 0 (black) .. 1 (white). */
  brightness: number;
  /** Blurriness estimate, 0 (sharp) .. 1 (very blurry). */
  blur: number;
}

// ---------- Pure text parsing (unit-tested) ----------

/** Words that identify non-name lines on a card face. */
const NAME_BLACKLIST =
  /^(hp\b|basic\b|stage\s?[12x]?\b|trainer\b|supporter\b|item\b|stadium\b|energy\b|evolves\b|ability\b|weakness\b|resistance\b|retreat\b|illus)/i;

/**
 * Extract a collector number from OCR text. Handles classic "4/102",
 * zero-padded "058/165", lettered "GG44/GG70" / "TG13/TG30", and slashless
 * promo codes like "SWSH244" or "SVP 044". Leading zeros in the numeric part
 * are stripped so "058" matches a catalog "58".
 */
export function extractCollectorNumber(text: string): string | undefined {
  const stripZeros = (prefix: string, digits: string, suffix = ''): string =>
    `${prefix.toUpperCase()}${String(parseInt(digits, 10))}${suffix}`;

  // "GG44/GG70", "058/165", "4/102" — take the part before the slash. Letter
  // prefixes are always glued to the digits; allowing a space here would let
  // a name fragment ("…zard 4/102") masquerade as a prefix.
  const slash = text.match(/\b([A-Za-z]{0,4})(\d{1,3})([a-z])?\s*\/\s*[A-Za-z]{0,4}\d{1,3}\b/);
  if (slash) return stripZeros(slash[1] ?? '', slash[2]!, slash[3] ?? '');

  // Slashless promo numbering: "SWSH244", "SVP 044", "SM210", "XY67".
  const promo = text.match(/\b(SVP|SWSH|SM|XY|BW|DP|HGSS)\s?-?\s?(\d{2,3})\b/i);
  if (promo) return stripZeros(promo[1]!, promo[2]!);

  return undefined;
}

/**
 * Pick the card name from OCR lines: the highest-scoring mostly-alphabetic,
 * confident line in the top band of the image. Trailing HP readings are
 * stripped ("Charizard 120 HP" → "Charizard").
 */
export function extractCardName(lines: OcrLine[], imageHeight: number): string | undefined {
  const topBand = imageHeight * 0.45;
  const candidates = lines
    .filter((l) => l.y <= topBand && l.confidence >= 35)
    .map((l) => cleanupName(l.text))
    .filter((t): t is string => Boolean(t));

  // Prefer longer alphabetic runs — the name is the most prominent text line.
  candidates.sort(
    (a, b) => b.replace(/[^A-Za-zÀ-ÿ]/g, '').length - a.replace(/[^A-Za-zÀ-ÿ]/g, '').length,
  );
  return candidates[0];
}

/** Normalize an OCR'd name line; returns undefined when it can't be a name. */
export function cleanupName(raw: string): string | undefined {
  let t = raw.trim();
  if (!t || NAME_BLACKLIST.test(t)) return undefined;
  // Drop HP readings and anything after them: "Charizard 120 HP", "Mew HP60".
  t = t.replace(/\s*\d*\s*HP\s*\d*.*$/i, '');
  // Keep letters (incl. é in Pokémon), digits inside names are noise — strip
  // everything that can't appear in a printed card name.
  t = t.replace(/[^A-Za-zÀ-ÿ'’.\-&: ]/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const alpha = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (alpha.length < 3) return undefined;
  return t;
}

// ---------- Canvas preprocessing + OCR orchestration (browser only) ----------

interface Band {
  /** Fraction of image height where the band starts. */
  top: number;
  /** Fraction of image height the band covers. */
  height: number;
}

const NAME_BAND: Band = { top: 0, height: 0.45 };
const NUMBER_BAND: Band = { top: 0.7, height: 0.3 };
const OCR_TIMEOUT_MS = 20_000;

/** Crop a band, upscale to a target width, grayscale, and contrast-stretch. */
function preprocessBand(bitmap: ImageBitmap, band: Band, targetWidth: number): HTMLCanvasElement {
  const sy = Math.floor(bitmap.height * band.top);
  const sh = Math.max(1, Math.floor(bitmap.height * band.height));
  const scale = Math.max(1, targetWidth / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(sh * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, sy, bitmap.width, sh, 0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // Grayscale + percentile contrast stretch (2%..98%) — lifts low-contrast
  // name text off busy artwork far better than a fixed threshold.
  const grays = new Uint8ClampedArray(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const g = (d[i]! * 0.299 + d[i + 1]! * 0.587 + d[i + 2]! * 0.114) | 0;
    grays[p] = g;
    hist[g]!++;
  }
  const total = w * h;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255; lo++) {
    acc += hist[lo]!;
    if (acc > total * 0.02) break;
  }
  for (let acc = 0; hi > 0; hi--) {
    acc += hist[hi]!;
    if (acc > total * 0.02) break;
  }
  const range = Math.max(1, hi - lo);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const v = Math.max(0, Math.min(255, ((grays[p]! - lo) * 255) / range));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Mean-luma brightness and Laplacian-variance blurriness on a small copy. */
export async function computeQuality(file: Blob): Promise<QualityMetrics> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 320;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(8, Math.round(bitmap.width * scale));
  const h = Math.max(8, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
    gray[p] = g;
    sum += g;
  }
  const mean = sum / (w * h);

  // Variance of the 4-neighbor Laplacian — the standard cheap sharpness proxy.
  let lapSum = 0;
  let lapSqSum = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const lap = 4 * gray[p]! - gray[p - 1]! - gray[p + 1]! - gray[p - w]! - gray[p + w]!;
      lapSum += lap;
      lapSqSum += lap * lap;
      n++;
    }
  }
  const lapMean = lapSum / n;
  const variance = lapSqSum / n - lapMean * lapMean;

  // Map variance to a lenient 0..1 blurriness. Calibrated so obviously soft
  // photos land above the server's 0.6 rejection line and typical phone shots
  // stay well below it.
  const blur = Math.max(0, Math.min(1, 1 - Math.log10(Math.max(variance, 1) / 15) / 1.8));

  return { brightness: Math.max(0, Math.min(1, mean / 255)), blur };
}

/**
 * Run the two-band OCR pass. Never rejects the scan on its own: on timeout or
 * engine failure it resolves with empty hints so the server vision pass (when
 * configured) can still identify the card.
 */
export async function runCardOcr(file: Blob): Promise<CardOcrResult> {
  const empty: CardOcrResult = { rawText: '' };
  const workerRef: { current: import('tesseract.js').Worker | null } = { current: null };
  let timedOut = false;
  try {
    const result = await Promise.race([
      (async () => {
        const bitmap = await createImageBitmap(file);
        const nameCanvas = preprocessBand(bitmap, NAME_BAND, 1200);
        const numberCanvas = preprocessBand(bitmap, NUMBER_BAND, 1200);
        const sourceHeight = bitmap.height;
        bitmap.close();

        const { createWorker, PSM } = await import('tesseract.js');
        const worker = await createWorker('eng');
        workerRef.current = worker;
        if (timedOut) {
          // The race already resolved; free the WASM worker instead of leaking it.
          void worker.terminate().catch(() => {});
          return empty;
        }

        const namePass = await worker.recognize(nameCanvas);
        // Map band-local pixel y back into source-image pixels.
        const toSourceY = (y0: number): number =>
          (y0 * sourceHeight * NAME_BAND.height) / nameCanvas.height;
        const lines: OcrLine[] = (namePass.data.lines ?? []).map((l) => ({
          text: l.text,
          confidence: l.confidence,
          y: toSourceY(l.bbox?.y0 ?? 0),
        }));
        const name = extractCardName(lines, sourceHeight);

        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/ ',
          tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        });
        const numberPass = await worker.recognize(numberCanvas);
        const number =
          extractCollectorNumber(numberPass.data.text) ??
          extractCollectorNumber(namePass.data.text);

        return {
          name,
          number,
          rawText: `${namePass.data.text}\n${numberPass.data.text}`.slice(0, 2000),
        };
      })(),
      new Promise<CardOcrResult>((resolve) =>
        setTimeout(() => {
          timedOut = true;
          resolve(empty);
        }, OCR_TIMEOUT_MS),
      ),
    ]);
    return result;
  } catch (err) {
    // Hints are best-effort — never fail the scan — but do leave a trace.
    // eslint-disable-next-line no-console
    console.warn('[scan-ocr] on-device OCR failed:', err);
    return empty;
  } finally {
    // Fire-and-forget: terminate() frees the WASM worker.
    void workerRef.current?.terminate().catch(() => {});
  }
}
