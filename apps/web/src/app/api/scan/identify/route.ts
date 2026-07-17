import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling, parse } from '@/lib/api';
import { getRegistry } from '@/lib/providers';
import { getEntitlementContext, checkQuickScan } from '@/lib/services/entitlements';
import { hasOpenAiScan, identifyCardWithOpenAI } from '@/lib/services/scan-llm';

const metric = z.number().min(0).max(1).optional();

const bodySchema = z.object({
  // The captured photo as a compressed data URL (analyzed in-memory, never
  // stored), or the literal "camera" from clients that only send OCR hints.
  imageRef: z.string().min(1).max(2_000_000),
  // On-device OCR text (name/number) extracted from the photo by the scanner.
  ocr: z
    .object({
      name: z.string().max(120).optional(),
      number: z.string().max(24).optional(),
      setName: z.string().max(120).optional(),
      rawText: z.string().max(4000).optional(),
    })
    .optional(),
  // Client-computed quality metrics; each optional — clients send only what
  // they actually measured. The server re-decides acceptance.
  quality: z
    .object({
      blur: metric,
      glare: metric,
      coverage: metric,
      brightness: metric,
    })
    .optional(),
});

const CONFIDENCE_THRESHOLD = 0.75;

const isImageDataUrl = (ref: string): boolean => /^data:image\/[a-z+.-]+;base64,/i.test(ref);

export const POST = withErrorHandling(async (req: Request) => {
  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;

  // Server-side usage gate BEFORE any (potentially paid) provider call.
  const ctx = await getEntitlementContext();
  const gate = checkQuickScan(ctx);
  if (!gate.allowed) {
    return jsonError('usage_limit_reached', gate.message);
  }

  // Server re-validates image quality; poor images are rejected with guidance.
  const q = parsed.value.quality;
  if (q) {
    const issues: string[] = [];
    if (q.blur !== undefined && q.blur > 0.6)
      issues.push('The image looks blurry — hold steady and refocus.');
    if (q.glare !== undefined && q.glare > 0.5)
      issues.push('Glare is hiding part of the card — reduce direct light.');
    if (q.coverage !== undefined && q.coverage < 0.4)
      issues.push('Move closer so the card fills the frame.');
    if (q.brightness !== undefined && q.brightness < 0.2)
      issues.push('Too dark — use brighter indirect light.');
    if (q.brightness !== undefined && q.brightness > 0.95)
      issues.push('Overexposed — reduce lighting.');
    if (issues.length > 0) {
      return jsonError('image_rejected', issues.join(' '));
    }
  }

  // Start from on-device OCR hints, then upgrade with server vision when
  // available — Tesseract routinely misreads stylized names on holo foil,
  // while a vision model reads them reliably.
  const ocr: { name?: string; number?: string; setName?: string; rawText?: string } = {
    ...parsed.value.ocr,
  };
  let identifiedBy: 'device-ocr' | 'vision' = 'device-ocr';
  let visionLanguage: string | undefined;

  if (hasOpenAiScan() && isImageDataUrl(parsed.value.imageRef)) {
    try {
      const vision = await identifyCardWithOpenAI(parsed.value.imageRef);
      if (vision === null) {
        return jsonError(
          'image_rejected',
          "That doesn't look like a Pokémon card. Center one card in the frame and try again.",
        );
      }
      if (vision.name || vision.number) {
        // Vision hints win; device OCR fills any gaps.
        if (vision.name) ocr.name = vision.name;
        if (vision.number) ocr.number = vision.number;
        if (vision.setName) ocr.setName = vision.setName;
        if (vision.language) visionLanguage = vision.language;
        identifiedBy = 'vision';
      }
    } catch (err) {
      // Fall back to on-device OCR hints rather than failing the scan.
      // eslint-disable-next-line no-console
      console.error('[scan/identify] vision identification failed:', err);
    }
  }

  if (!ocr.name && !ocr.number) {
    return jsonError(
      'image_rejected',
      'Could not read the card name or number. Retake with the card flat, filling the frame, in bright indirect light.',
    );
  }

  const result = await getRegistry().call('recognition', 'identifyCard', (a) =>
    a.identifyCard({
      imageRef: parsed.value.imageRef,
      ocr,
      language: visionLanguage,
    }),
  );

  const top = result.candidates[0];
  const requiresConfirmation =
    result.requiresConfirmation || !top || top.confidence < CONFIDENCE_THRESHOLD;

  return jsonOk({
    candidates: result.candidates,
    requiresConfirmation,
    remaining: gate.remaining,
    identifiedBy,
    readText: { name: ocr.name ?? null, number: ocr.number ?? null },
  });
});
