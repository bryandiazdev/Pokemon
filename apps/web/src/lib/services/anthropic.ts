import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env';

/** Shared Anthropic client for the vision services (scan + grade). */

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      timeout: 90_000,
      maxRetries: 1,
    });
  }
  return client;
}

/** Map Anthropic SDK errors to user-meaningful messages, then rethrow. */
export function rethrowAnthropic(err: unknown): never {
  if (err instanceof Anthropic.AuthenticationError) {
    throw new Error('The Anthropic API key was rejected (401). Check ANTHROPIC_API_KEY.');
  }
  if (err instanceof Anthropic.RateLimitError) {
    throw new Error('Anthropic rate limit hit. Try again in a moment.');
  }
  if (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)) {
    throw new Error(
      'The Anthropic account is out of credits. Add credits in the Anthropic Console billing page.',
    );
  }
  if (err instanceof Anthropic.APIError) {
    throw new Error(`Anthropic request failed (${err.status ?? 'network'}).`);
  }
  throw err;
}

const ALLOWED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const);
export type AllowedImageMedia = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export function toAllowedMedia(mime: string | undefined): AllowedImageMedia {
  const m = (mime ?? '').toLowerCase();
  return ALLOWED_MEDIA.has(m as AllowedImageMedia) ? (m as AllowedImageMedia) : 'image/jpeg';
}
