import 'server-only';
import { z } from 'zod';
import type { LimitingFinding, SubScores } from '@psr/grading-rules';
import { env } from '../env';

/**
 * OpenAI vision-backed grade analysis. Sends uploaded card photos to a
 * vision-capable chat model and parses structured condition scores.
 *
 * This is still an *estimate* — never a professional grade. The model is asked
 * to be conservative and honest about uncertainty / image limits.
 */

export interface LlmGradeAnalysis {
  scores: SubScores;
  findings: LimitingFinding[];
  limitingDefects: string[];
  suggestedRecaptures: string[];
  summary: string;
  cardIdentification: string | null;
  model: string;
}

const llmJsonSchema = z.object({
  scores: z.object({
    centering: z.number().min(0).max(100),
    corner: z.number().min(0).max(100),
    edge: z.number().min(0).max(100),
    surface: z.number().min(0).max(100),
    structural: z.number().min(0).max(100),
    imageQuality: z.number().min(0).max(100),
  }),
  findings: z
    .array(
      z.object({
        key: z.string(),
        severity: z.enum(['none', 'minor', 'moderate', 'severe']),
        title: z.string(),
      }),
    )
    .default([]),
  limitingDefects: z.array(z.string()).default([]),
  suggestedRecaptures: z.array(z.string()).default([]),
  summary: z.string().min(1),
  cardIdentification: z.string().nullable().optional(),
});

const SYSTEM_PROMPT = `You are an expert Pokémon TCG card condition analyst assisting collectors before they submit to PSA/BGS/CGC.

You receive labeled photos of the SAME physical card (front, back, angled light, optional corner close-ups).

Rules:
- Be CONSERVATIVE. Prefer under-scoring over optimism. Cameras miss micro-scratches and print lines.
- Score each category 0–100 (100 = gem-mint appearance in the photos).
- imageQuality reflects focus, glare, framing, and lighting — not card condition.
- If a photo is too poor to judge a category, lower that score and imageQuality, and suggest a recapture.
- Never claim a guaranteed PSA/BGS grade. This is an estimate only.
- Ignore sleeves, fingers, and background when possible; if they obscure the card, say so.
- Respond with ONLY valid JSON matching the schema (no markdown fences).`;

function userPrompt(captureTypes: string[]): string {
  return `Analyze these card captures for grade potential.
Capture order / labels: ${captureTypes.join(', ')}.

Return JSON with this exact shape:
{
  "scores": {
    "centering": 0-100,
    "corner": 0-100,
    "edge": 0-100,
    "surface": 0-100,
    "structural": 0-100,
    "imageQuality": 0-100
  },
  "findings": [{ "key": "string", "severity": "none|minor|moderate|severe", "title": "short title" }],
  "limitingDefects": ["..."],
  "suggestedRecaptures": ["..."],
  "summary": "2-4 sentences of plain-language analysis for the collector",
  "cardIdentification": "best-guess card name / set / number, or null"
}`;
}

async function fileToDataUrl(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence?.[1]?.trim() ?? trimmed;
  return JSON.parse(raw);
}

export function hasOpenAiGrade(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}

/**
 * Analyze uploaded grade captures with OpenAI vision.
 * Throws on API / parse failures so the caller can fall back.
 */
export async function analyzeGradeWithOpenAI(
  files: File[],
  captureTypes: string[],
): Promise<LlmGradeAnalysis> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  if (files.length === 0) {
    throw new Error('No images provided for LLM analysis');
  }

  const model = env.OPENAI_GRADE_MODEL || 'gpt-4o';
  // Cap images to keep latency/cost reasonable (required 3 + up to 2 extras).
  const limit = Math.min(files.length, 5);
  const pairs = files.slice(0, limit).map((f, i) => ({
    file: f,
    type: captureTypes[i] ?? `capture_${i}`,
  }));

  const dataUrls = await Promise.all(pairs.map((p) => fileToDataUrl(p.file)));

  type ContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail: 'low' | 'high' } };

  const content: ContentPart[] = [{ type: 'text', text: userPrompt(pairs.map((p) => p.type)) }];
  for (let i = 0; i < dataUrls.length; i++) {
    content.push({
      type: 'text',
      text: `Photo ${i + 1}: ${pairs[i]!.type}`,
    });
    content.push({
      type: 'image_url',
      image_url: {
        url: dataUrls[i]!,
        // High detail on primary shots; low on optional corners to save tokens.
        detail: pairs[i]!.type.startsWith('corner') ? 'low' : 'high',
      },
    });
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      max_tokens: 1200,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // eslint-disable-next-line no-console
    console.error('[grade-llm] OpenAI error', res.status, detail.slice(0, 500));
    if (res.status === 401)
      throw new Error('OpenAI API key was rejected (401). Check OPENAI_API_KEY.');
    if (res.status === 429)
      throw new Error(
        detail.includes('insufficient_quota')
          ? 'The OpenAI account is out of credits (insufficient_quota). Add credits in the OpenAI billing dashboard.'
          : 'OpenAI rate limit hit. Try again in a moment.',
      );
    throw new Error(`OpenAI request failed (${res.status}).`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI returned an empty response.');

  const parsed = llmJsonSchema.safeParse(extractJson(text));
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('[grade-llm] schema mismatch', parsed.error.flatten());
    throw new Error('OpenAI returned an unexpected analysis shape.');
  }

  const data = parsed.data;
  return {
    scores: {
      centering: Math.round(data.scores.centering),
      corner: Math.round(data.scores.corner),
      edge: Math.round(data.scores.edge),
      surface: Math.round(data.scores.surface),
      structural: Math.round(data.scores.structural),
      imageQuality: Math.round(data.scores.imageQuality),
    },
    findings: data.findings.filter((f) => f.severity !== 'none'),
    limitingDefects: data.limitingDefects,
    suggestedRecaptures: data.suggestedRecaptures,
    summary: data.summary.trim(),
    cardIdentification: data.cardIdentification?.trim() || null,
    model,
  };
}

/** Average two score sets (e.g. CV + LLM) when both analyzers ran. */
export function blendScores(a: SubScores, b: SubScores, weightB = 0.45): SubScores {
  const wA = 1 - weightB;
  const mix = (x: number, y: number) => Math.round(x * wA + y * weightB);
  return {
    centering: mix(a.centering, b.centering),
    corner: mix(a.corner, b.corner),
    edge: mix(a.edge, b.edge),
    surface: mix(a.surface, b.surface),
    structural: mix(a.structural, b.structural),
    imageQuality: mix(a.imageQuality, b.imageQuality),
  };
}
