import 'server-only';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { env } from '../env';
import { getAnthropic, rethrowAnthropic, toAllowedMedia, type AllowedImageMedia } from './anthropic';

/**
 * Vision-backed card identification for the quick-scan flow.
 *
 * On-device OCR (Tesseract) struggles with stylized card names on holo foil.
 * When a vision provider is configured, the scan route sends the photo — plus
 * an enlarged crop of the bottom strip where the tiny collector number lives —
 * to a vision model that reads the printed name, collector number, and set,
 * and those hints feed the catalog-OCR ranking adapter exactly like on-device
 * OCR hints would. Images are analyzed in-memory and never stored.
 *
 * Providers: Anthropic (Claude, preferred when ANTHROPIC_API_KEY is set) and
 * OpenAI (fallback). Claude uses structured outputs, so the response is
 * schema-enforced rather than parsed from free text.
 */

export interface ScanImage {
  /** Short human label the model sees, e.g. "full card". */
  label: string;
  /** data:image/...;base64 URL. */
  dataUrl: string;
}

export interface LlmCardIdentification {
  /** Card name exactly as printed, e.g. "Charizard ex". */
  name: string | null;
  /** Collector number before the slash, e.g. "4" from "4/102", or "SVP044". */
  number: string | null;
  /** Set name if legible, e.g. "Obsidian Flames". */
  setName: string | null;
  /** Total in the set if printed, e.g. "102" from "4/102". */
  setTotal: string | null;
  /** ISO 639-1 language of the printed card text. */
  language: string | null;
  /** Model's own 0..1 confidence that the name reading is correct. */
  confidence: number;
  model: string;
}

const idSchema = z.object({
  isPokemonCard: z.boolean(),
  name: z.string().nullable(),
  number: z.string().nullable(),
  setName: z.string().nullable(),
  setTotal: z.string().nullable(),
  language: z.string().nullable(),
  confidence: z.number(),
});

// Hand-written JSON schema for Claude structured outputs (the SDK's zod
// helper requires zod v4; this app is on zod 3). Numerical range constraints
// aren't supported by structured outputs — confidence is clamped client-side.
const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] };
const ID_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isPokemonCard', 'name', 'number', 'setName', 'setTotal', 'language', 'confidence'],
  properties: {
    isPokemonCard: { type: 'boolean' },
    name: nullableString,
    number: nullableString,
    setName: nullableString,
    setTotal: nullableString,
    language: nullableString,
    confidence: { type: 'number' },
  },
} as const;

const SYSTEM_PROMPT = `You read Pokémon TCG card photos and transcribe the printed identifying text with maximum accuracy.

Rules:
- The photo may be rotated, tilted, sleeved, or glary — read through it. If rotated, mentally rotate before reading.
- Transcribe the card NAME exactly as printed at the top. Preserve suffixes and their exact casing: "ex" (lowercase, modern) vs "EX" (uppercase, older), "GX", "V", "VMAX", "VSTAR", "BREAK", "Radiant", "Shining", owner prefixes ("Team Rocket's", "Misty's"), and forms ("Alolan", "Galarian", "Origin Forme"). Do not add words that are not printed.
- The COLLECTOR NUMBER is printed small near the bottom-left or bottom-right, usually "N/M" (e.g. "4/102", "058/165", "GG44/GG70", "TG13/TG30") or a promo code ("SVP 044", "SWSH244", black-star promos). Report only the part BEFORE the slash, keeping any letter prefix exactly ("GG44", "TG13", "SVP044"). Strip leading zeros from purely numeric values ("058" → "58"). If an enlarged bottom-strip image is provided, trust it over the full-card image for this field.
- setTotal is the part AFTER the slash if present ("102" from "4/102"; "GG70" → "70"). Null if there is no slash.
- Report the SET NAME only when a set name is actually printed/legible or unambiguous from the set symbol; otherwise null. Never guess.
- language: ISO 639-1 code of the card's printed language (en, ja, fr, de, es, it, pt, ko, zh).
- If the photo is not a Pokémon card at all, set isPokemonCard=false and everything else null.
- confidence: your honest 0..1 confidence in the NAME transcription specifically.`;

function userPrompt(labels: string[]): string {
  return `Identify this card. Images provided: ${labels.join('; ')}. All images show the SAME physical card. Return the identification as JSON.`;
}

/** Split a data URL into Claude's base64 image source parts. */
export function parseDataUrl(
  dataUrl: string,
): { mediaType: AllowedImageMedia; data: string } | null {
  const m = dataUrl.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
  if (!m) return null;
  return { mediaType: toAllowedMedia(m[1]), data: m[2]! };
}

export type VisionProvider = 'anthropic' | 'openai';

/** Which vision provider will serve scan identification, if any. */
export function visionScanProvider(): VisionProvider | null {
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  if (env.OPENAI_API_KEY) return 'openai';
  return null;
}

export function hasVisionScan(): boolean {
  return visionScanProvider() !== null;
}

/**
 * Read the card name / collector number / set off one or more photos of the
 * same card, using whichever vision provider is configured. Returns null when
 * the image is not a Pokémon card. Throws on API/parse failures so the caller
 * can fall back to on-device OCR hints.
 */
export async function identifyCardWithVision(
  images: ScanImage[],
): Promise<LlmCardIdentification | null> {
  const provider = visionScanProvider();
  if (!provider) throw new Error('No vision provider configured (set ANTHROPIC_API_KEY).');
  if (images.length === 0) throw new Error('No images provided for identification');
  return provider === 'anthropic'
    ? identifyCardWithClaude(images)
    : identifyCardWithOpenAI(images);
}

function normalizeIdentification(
  data: z.infer<typeof idSchema>,
  model: string,
): LlmCardIdentification | null {
  if (!data.isPokemonCard) return null;

  const cleanNumber = (n: string | null): string | null => {
    if (!n) return null;
    const t = n.trim().replace(/\s+/g, '');
    // "058" → "58" but "GG04" stays as printed (letter prefixes are meaningful).
    return /^\d+$/.test(t) ? String(parseInt(t, 10)) : t;
  };
  const cleanTotal = (n: string | null): string | null => {
    if (!n) return null;
    const digits = n.replace(/\D/g, '');
    return digits ? String(parseInt(digits, 10)) : null;
  };

  return {
    name: data.name?.trim() || null,
    number: cleanNumber(data.number),
    setName: data.setName?.trim() || null,
    setTotal: cleanTotal(data.setTotal),
    language: data.language?.trim().toLowerCase() || null,
    confidence: Math.max(0, Math.min(1, data.confidence)),
    model,
  };
}

// ---------- Anthropic (Claude) ----------

async function identifyCardWithClaude(
  images: ScanImage[],
): Promise<LlmCardIdentification | null> {
  const model = env.ANTHROPIC_SCAN_MODEL || 'claude-opus-4-8';
  const client = getAnthropic();

  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of images) {
    const parsed = parseDataUrl(img.dataUrl);
    if (!parsed) continue;
    content.push({ type: 'text', text: `Image: ${img.label}` });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data },
    });
  }
  if (content.length === 0) throw new Error('No decodable images provided');
  content.push({ type: 'text', text: userPrompt(images.map((i) => i.label)) });

  const response = await client.messages
    .create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
      output_config: { format: { type: 'json_schema', schema: ID_JSON_SCHEMA } },
    })
    .catch(rethrowAnthropic);

  const text = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  )?.text;
  if (response.stop_reason === 'refusal' || !text) {
    throw new Error('Claude returned no identification for this image.');
  }
  const parsed = idSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('[scan-llm] Claude schema mismatch', parsed.error.flatten());
    throw new Error('Claude returned an unexpected identification shape.');
  }
  return normalizeIdentification(parsed.data, model);
}

// ---------- OpenAI (fallback) ----------

const OPENAI_USER_SUFFIX = `
Return JSON exactly:
{
  "isPokemonCard": true/false,
  "name": "printed card name" | null,
  "number": "collector number before the slash" | null,
  "setName": "printed set name" | null,
  "setTotal": "total after the slash, digits only" | null,
  "language": "two-letter code" | null,
  "confidence": 0-1
}
Respond with ONLY valid JSON (no markdown fences).`;

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence?.[1]?.trim() ?? trimmed;
  return JSON.parse(raw);
}

async function identifyCardWithOpenAI(
  images: ScanImage[],
): Promise<LlmCardIdentification | null> {
  const model = env.OPENAI_SCAN_MODEL || 'gpt-4o';

  type ContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail: 'low' | 'high' } };

  const content: ContentPart[] = [
    { type: 'text', text: userPrompt(images.map((i) => i.label)) + OPENAI_USER_SUFFIX },
  ];
  for (const img of images) {
    content.push({ type: 'text', text: `Image: ${img.label}` });
    content.push({ type: 'image_url', image_url: { url: img.dataUrl, detail: 'high' } });
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      max_tokens: 300,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // eslint-disable-next-line no-console
    console.error('[scan-llm] OpenAI error', res.status, detail.slice(0, 500));
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

  const parsed = idSchema.safeParse(extractJson(text));
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('[scan-llm] schema mismatch', parsed.error.flatten());
    throw new Error('OpenAI returned an unexpected identification shape.');
  }
  return normalizeIdentification(parsed.data, model);
}
