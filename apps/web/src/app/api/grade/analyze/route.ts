import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling, parse } from '@/lib/api';
import {
  evaluateGrade,
  DISCLAIMER_VERSION,
  GRADE_DISCLAIMER,
  type SubScores,
  type LimitingFinding,
  type GradeEstimate,
} from '@psr/grading-rules';
import type { SubmissionRecommendation } from '@psr/types';
import { getEntitlementContext, checkGradeScan } from '@/lib/services/entitlements';
import { env } from '@/lib/env';

/**
 * Grade-potential analysis.
 *
 * - multipart/form-data with `files` + `capture_types` → preferred path when the
 *   user uploaded photos. Proxies to the vision service when configured.
 * - application/json with optional scores → demo / EV tooling path.
 */

const REQUIRED_CAPTURES = ['front', 'back', 'front_angled'] as const;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

const bodySchema = z.object({
  cardExternalId: z.string().optional(),
  scores: z
    .object({
      centering: z.number().min(0).max(100),
      corner: z.number().min(0).max(100),
      edge: z.number().min(0).max(100),
      surface: z.number().min(0).max(100),
      structural: z.number().min(0).max(100),
      imageQuality: z.number().min(0).max(100),
    })
    .optional(),
  findings: z
    .array(
      z.object({
        key: z.string(),
        severity: z.enum(['none', 'minor', 'moderate', 'severe']),
        title: z.string(),
      }),
    )
    .optional(),
  /** Capture keys that were uploaded (demo path without vision). */
  captures: z.array(z.string()).optional(),
});

const SAMPLE_SCORES: SubScores = {
  centering: 88,
  corner: 84,
  edge: 90,
  surface: 72,
  structural: 96,
  imageQuality: 82,
};

interface VisionGradeResponse {
  estimated_min_grade: number;
  estimated_max_grade: number;
  estimated_ceiling: number;
  overall_confidence: number;
  centering_score: number;
  corner_score: number;
  edge_score: number;
  surface_score: number;
  structural_score: number;
  image_quality_score: number;
  limiting_defects: string[];
  suggested_recaptures: string[];
  submission_recommendation: string;
  findings?: Array<{
    category?: string;
    severity?: string;
    title?: string;
  }>;
  model_version?: string;
  disclaimer?: string;
  disclaimer_version?: string;
}

function jsonReport(opts: {
  scores: SubScores;
  findings?: LimitingFinding[];
  modelVersion: string;
  remaining: number | null;
  captures?: string[];
  estimateOverride?: GradeEstimate;
  disclaimer?: string;
}) {
  const estimate = opts.estimateOverride ?? evaluateGrade(opts.scores, opts.findings ?? []);
  return jsonOk({
    estimate,
    scores: opts.scores,
    modelVersion: opts.modelVersion,
    disclaimerVersion: DISCLAIMER_VERSION,
    disclaimer: opts.disclaimer ?? GRADE_DISCLAIMER,
    remaining: opts.remaining,
    captures: opts.captures ?? [],
  });
}

async function proxyToVision(
  files: File[],
  captureTypes: string[],
): Promise<VisionGradeResponse | { error: string; status: number }> {
  const base = env.VISION_SERVICE_URL!.replace(/\/$/, '');
  const fd = new FormData();
  for (const file of files) fd.append('files', file, file.name);
  for (const t of captureTypes) fd.append('capture_types', t);

  const headers: Record<string, string> = {};
  if (env.VISION_SERVICE_API_KEY) headers['x-api-key'] = env.VISION_SERVICE_API_KEY;

  let res: Response;
  try {
    res = await fetch(`${base}/v1/cards/grade-potential`, {
      method: 'POST',
      headers,
      body: fd,
      signal: AbortSignal.timeout(55_000),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[grade/analyze] vision fetch failed:', err);
    return { error: 'Vision service unreachable. Try again in a moment.', status: 502 };
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // eslint-disable-next-line no-console
    console.error('[grade/analyze] vision error', res.status, detail.slice(0, 400));
    return {
      error:
        res.status === 422
          ? 'Could not detect a card in one of the photos. Retake front/back with the card flat and fully in frame.'
          : 'Vision analysis failed. Please retake clearer photos and try again.',
      status: res.status >= 500 ? 502 : 422,
    };
  }

  return (await res.json()) as VisionGradeResponse;
}

function mapVision(v: VisionGradeResponse) {
  const scores: SubScores = {
    centering: Math.round(v.centering_score),
    corner: Math.round(v.corner_score),
    edge: Math.round(v.edge_score),
    surface: Math.round(v.surface_score),
    structural: Math.round(v.structural_score),
    imageQuality: Math.round(v.image_quality_score),
  };
  const findings: LimitingFinding[] = (v.findings ?? [])
    .filter((f) => f.severity && f.severity !== 'none')
    .map((f) => ({
      key: f.category ?? 'defect',
      severity: (['minor', 'moderate', 'severe'].includes(f.severity ?? '')
        ? f.severity
        : 'moderate') as LimitingFinding['severity'],
      title: f.title ?? 'Observed defect',
    }));

  return {
    scores,
    findings,
    estimate: {
      estimatedMinGrade: v.estimated_min_grade,
      estimatedMaxGrade: v.estimated_max_grade,
      estimatedCeiling: v.estimated_ceiling,
      overallConfidence: v.overall_confidence,
      submissionRecommendation: v.submission_recommendation as SubmissionRecommendation,
      limitingDefects: v.limiting_defects ?? [],
      suggestedRecaptures: v.suggested_recaptures ?? [],
      rulesVersion: 'vision',
    } satisfies GradeEstimate,
    modelVersion: v.model_version ?? 'vision-live',
    disclaimer: v.disclaimer,
  };
}

export const POST = withErrorHandling(async (req: Request) => {
  const ctx = await getEntitlementContext();
  const gate = checkGradeScan(ctx);
  if (!gate.allowed) return jsonError('usage_limit_reached', gate.message);

  const contentType = req.headers.get('content-type') ?? '';

  // ---------- Multipart (photo uploads) ----------
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const files = form.getAll('files').filter((v): v is File => {
      return typeof v === 'object' && v !== null && 'arrayBuffer' in v && 'name' in v;
    });
    const captureTypes = form.getAll('capture_types').map(String);

    if (files.length === 0) {
      return jsonError('validation_error', 'Upload at least the required card photos.');
    }
    if (files.length !== captureTypes.length) {
      return jsonError('validation_error', 'Each photo must include a capture type.');
    }
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        return jsonError('validation_error', `"${file.name}" is too large (max 12 MB).`);
      }
      if (file.type && !ALLOWED_TYPES.has(file.type) && !file.type.startsWith('image/')) {
        return jsonError('validation_error', `"${file.name}" must be a JPEG, PNG, or WebP image.`);
      }
    }

    const present = new Set(captureTypes);
    const missing = REQUIRED_CAPTURES.filter((k) => !present.has(k));
    if (missing.length > 0) {
      return jsonError(
        'validation_error',
        `Missing required captures: ${missing.join(', ')}.`,
      );
    }

    if (env.VISION_SERVICE_URL) {
      const vision = await proxyToVision(files, captureTypes);
      if ('error' in vision) {
        return jsonError(
          vision.status === 422 ? 'validation_error' : 'internal_error',
          vision.error,
        );
      }
      const mapped = mapVision(vision);
      return jsonReport({
        scores: mapped.scores,
        findings: mapped.findings,
        estimateOverride: mapped.estimate,
        modelVersion: mapped.modelVersion,
        remaining: gate.remaining,
        captures: captureTypes,
        disclaimer: mapped.disclaimer,
      });
    }

    // Demo path: photos were provided, but no vision service — run the shared
    // rules engine on sample sub-scores so the flow stays demonstrable.
    const findings: LimitingFinding[] = [];
    if (!present.has('front_angled')) {
      findings.push({
        key: 'surface_obscured',
        severity: 'moderate',
        title: 'Angled light capture missing',
      });
    }
    return jsonReport({
      scores: SAMPLE_SCORES,
      findings,
      modelVersion: 'cv-heuristic-0.1.0-demo',
      remaining: gate.remaining,
      captures: captureTypes,
    });
  }

  // ---------- JSON (legacy / tooling) ----------
  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;

  const captures = parsed.value.captures ?? [];
  if (captures.length > 0) {
    const present = new Set(captures);
    const missing = REQUIRED_CAPTURES.filter((k) => !present.has(k));
    if (missing.length > 0) {
      return jsonError(
        'validation_error',
        `Missing required captures: ${missing.join(', ')}.`,
      );
    }
  }

  const scores = parsed.value.scores ?? SAMPLE_SCORES;
  const findings = (parsed.value.findings ?? []) as LimitingFinding[];
  return jsonReport({
    scores,
    findings,
    modelVersion: env.VISION_SERVICE_URL ? 'vision-live' : 'cv-heuristic-0.1.0-demo',
    remaining: gate.remaining,
    captures,
  });
});
