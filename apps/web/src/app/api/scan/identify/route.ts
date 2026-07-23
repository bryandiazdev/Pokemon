import { z } from 'zod';
import { jsonOk, jsonError, jsonPaywall, withErrorHandling, parse } from '@/lib/api';
import { getRegistry } from '@/lib/providers';
import { isImageDataUrl, resolveSetExternalId, mapVisionLanguage } from '@/lib/scan-catalog';
import {
  getEntitlementContext,
  checkQuickScan,
  consumeUsage,
  releaseUsage,
} from '@/lib/services/entitlements';
import { hasVisionScan, identifyCardWithVision, type ScanImage } from '@/lib/services/scan-llm';

const metric = z.number().min(0).max(1).optional();

const bodySchema = z.object({
  // The captured photo as a compressed data URL (analyzed in-memory, never
  // stored), or the literal "camera" from clients that only send OCR hints.
  imageRef: z.string().min(1).max(4_000_000),
  // Optional enlarged crop of the card's bottom strip — the tiny collector
  // number lives there and a dedicated crop reads far better than the full
  // frame at vision-model tile resolution.
  numberCrop: z.string().max(2_000_000).optional(),
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

export const POST = withErrorHandling(async (req: Request) => {
  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;

  // Server-side usage gate BEFORE any (potentially paid) provider call.
  const ctx = await getEntitlementContext();
  const gate = checkQuickScan(ctx);
  if (!gate.allowed) {
    return jsonPaywall(gate);
  }

  const visionAvailable = hasVisionScan();

  // Server re-validates image quality; poor images are rejected with guidance.
  // Only when vision is unavailable: the heuristics run on flat-background
  // phone photos with real false-positive rates, and a vision model judges
  // actual legibility far better than a Laplacian variance ever will.
  const q = parsed.value.quality;
  if (q && !visionAvailable) {
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

  // Metering: RESERVE one scan atomically before the (paid) vision work — a
  // conditional UPDATE, so concurrent requests can't race past the limit.
  // Any request that reaches the pipeline consumes the scan (the AI cost is
  // incurred even when no card matches); we REFUND only when OUR provider
  // fails, never for user-side photo problems that were already screened.
  const consumed = await consumeUsage(ctx, 'quick_scan');
  if (!consumed.allowed) {
    return jsonPaywall({
      reason: 'usage_limit_reached',
      message: `You've used all ${consumed.limit} scans this month.`,
      paywall: {
        plan: ctx.entitlements.plan,
        metric: 'quick_scan',
        used: consumed.current,
        limit: consumed.limit,
        recommendedPlan: ctx.entitlements.plan === 'free' ? 'collector' : 'pro',
      },
    });
  }

  // Start from on-device OCR hints, then upgrade with server vision when
  // available — Tesseract routinely misreads stylized names on holo foil,
  // while a vision model reads them reliably.
  const ocr: { name?: string; number?: string; setName?: string; rawText?: string } = {
    ...parsed.value.ocr,
  };
  let identifiedBy: 'device-ocr' | 'vision' = 'device-ocr';
  let visionLanguage: string | undefined;
  let setTotal: string | null = null;
  let visionError: string | null = null;

  if (visionAvailable && isImageDataUrl(parsed.value.imageRef)) {
    try {
      const images: ScanImage[] = [{ label: 'full card', dataUrl: parsed.value.imageRef }];
      if (parsed.value.numberCrop && isImageDataUrl(parsed.value.numberCrop)) {
        images.push({
          label: 'enlarged bottom strip of the same card (collector number is here)',
          dataUrl: parsed.value.numberCrop,
        });
      }
      const vision = await identifyCardWithVision(images);
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
        if (vision.language) visionLanguage = mapVisionLanguage(vision.language);
        setTotal = vision.setTotal;
        identifiedBy = 'vision';
      }
    } catch (err) {
      // Fall back to on-device OCR hints, but REMEMBER why vision failed —
      // blaming the user's photo for a server-side failure sends them into a
      // hopeless retake loop.
      visionError = err instanceof Error ? err.message : 'Vision analysis failed.';
      // eslint-disable-next-line no-console
      console.error('[scan/identify] vision identification failed:', err);
    }
  }

  if (!ocr.name && !ocr.number) {
    if (visionError) {
      // OUR provider failed — refund the reserved scan.
      await releaseUsage(ctx, 'quick_scan');
      return jsonError('internal_error', `Card identification is unavailable: ${visionError}`);
    }
    return jsonError(
      'image_rejected',
      visionAvailable
        ? 'Could not read the card name or number. Retake with the card flat, filling the frame, in bright indirect light.'
        : 'Could not read the card with on-device OCR, and server vision is not configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY for reliable scans). Retake with the card flat and well lit, or search manually.',
    );
  }

  const setExternalId = await resolveSetExternalId(ocr.setName ?? null, setTotal);

  let result;
  try {
    result = await getRegistry().call('recognition', 'identifyCard', (a) =>
      a.identifyCard({
        imageRef: parsed.value.imageRef,
        ocr,
        language: visionLanguage,
        setExternalId,
      }),
    );
  } catch (err) {
    // Catalog lookup infrastructure failed (timeout/rate limit). The card was
    // read fine — refund the reserved scan and say so honestly instead of
    // pretending the card has no match.
    await releaseUsage(ctx, 'quick_scan');
    // eslint-disable-next-line no-console
    console.error('[scan/identify] recognition lookup failed:', err);
    return jsonError(
      'provider_unavailable',
      `The card catalog is busy right now — "${ocr.name ?? ocr.number}" was read fine, so just try again in a moment.`,
    );
  }

  const top = result.candidates[0];
  const requiresConfirmation =
    result.requiresConfirmation || !top || top.confidence < CONFIDENCE_THRESHOLD;

  return jsonOk({
    candidates: result.candidates,
    requiresConfirmation,
    remaining: consumed.remaining,
    identifiedBy,
    visionAvailable,
    // Vision failed but device OCR produced *something* — flag that the
    // results rest on weak hints so the UI can warn instead of feigning
    // confidence over garbage.
    visionNote: visionError ? `Server vision failed: ${visionError}` : null,
    readText: { name: ocr.name ?? null, number: ocr.number ?? null },
  });
});
