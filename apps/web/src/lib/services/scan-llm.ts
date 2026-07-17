import 'server-only';
import { z } from 'zod';
import { env } from '../env';

/**
 * OpenAI vision-backed card identification for the quick-scan flow.
 *
 * On-device OCR (Tesseract) struggles with stylized card names on holo foil.
 * When OPENAI_API_KEY is configured, the scan route sends the photo — plus an
 * enlarged crop of the bottom strip where the tiny collector number lives —
 * to a vision model that reads the printed name, collector number, and set,
 * and those hints feed the catalog-OCR ranking adapter exactly like on-device
 * OCR hints would. Images are analyzed in-memory and never stored.
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
  number: z.string().max(24).nullable(),
  setName: z.string().max(120).nullable(),
  setTotal: z.string().max(12).nullable(),
  language: z.string().max(8).nullable(),
  confidence: z.number().min(0).max(1),
});

const SYSTEM_PROMPT = `You read Pokémon TCG card photos and transcribe the printed identifying text with maximum accuracy.

Rules:
- The photo may be rotated, tilted, sleeved, or glary — read through it. If rotated, mentally rotate before reading.
- Transcribe the card NAME exactly as printed at the top. Preserve suffixes and their exact casing: "ex" (lowercase, modern) vs "EX" (uppercase, older), "GX", "V", "VMAX", "VSTAR", "BREAK", "Radiant", "Shining", owner prefixes ("Team Rocket's", "Misty's"), and forms ("Alolan", "Galarian", "Origin Forme"). Do not add words that are not printed.
- The COLLECTOR NUMBER is printed small near the bottom-left or bottom-right, usually "N/M" (e.g. "4/102", "058/165", "GG44/GG70", "TG13/TG30") or a promo code ("SVP 044", "SWSH244", black-star promos). Report only the part BEFORE the slash, keeping any letter prefix exactly ("GG44", "TG13", "SVP044"). Strip leading zeros from purely numeric values ("058" → "58"). If an enlarged bottom-strip image is provided, trust it over the full-card image for this field.
- setTotal is the part AFTER the slash if present ("102" from "4/102"; "GG70" → "70"). Null if there is no slash.
- Report the SET NAME only when a set name is actually printed/legible or unambiguous from the set symbol; otherwise null. Never guess.
- language: ISO 639-1 code of the card's printed language (en, ja, fr, de, es, it, pt, ko, zh).
- If the photo is not a Pokémon card at all, set isPokemonCard=false and everything else null.
- confidence: your honest 0..1 confidence in the NAME transcription specifically.
- Respond with ONLY valid JSON (no markdown fences).`;

function userPrompt(labels: string[]): string {
  return `Identify this card. Images provided: ${labels.join('; ')}. All images show the SAME physical card.
Return JSON exactly:
{
  "isPokemonCard": true/false,
  "name": "printed card name" | null,
  "number": "collector number before the slash" | null,
  "setName": "printed set name" | null,
  "setTotal": "total after the slash, digits only" | null,
  "language": "two-letter code" | null,
  "confidence": 0-1
}`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence?.[1]?.trim() ?? trimmed;
  return JSON.parse(raw);
}

export function hasOpenAiScan(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}

/**
 * Read the card name / collector number / set off one or more photos of the
 * same card. Returns null when the image is not a Pokémon card. Throws on
 * API/parse failures so the caller can fall back to on-device OCR hints.
 */
export async function identifyCardWithOpenAI(
  images: ScanImage[],
): Promise<LlmCardIdentification | null> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  if (images.length === 0) {
    throw new Error('No images provided for identification');
  }

  const model = env.OPENAI_SCAN_MODEL || 'gpt-4o';

  type ContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail: 'low' | 'high' } };

  const content: ContentPart[] = [{ type: 'text', text: userPrompt(images.map((i) => i.label)) }];
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
    if (res.status === 429) throw new Error('OpenAI rate limit hit. Try again in a moment.');
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

  const data = parsed.data;
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
    confidence: data.confidence,
    model,
  };
}
