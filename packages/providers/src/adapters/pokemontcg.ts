/**
 * Pokémon TCG API catalog adapter (https://pokemontcg.io).
 *
 * Not affiliated with or endorsed by pokemontcg.io or The Pokémon Company.
 * Used only as a CATALOG source (sets, cards, images). Pricing embedded in this
 * API is limited and is NOT used as a substitute for a dedicated pricing provider.
 * An API key is optional but strongly recommended (rate limits are strict without one).
 */

import type {
  CardCatalogProvider,
  CardSearchInput,
  CardSearchResult,
  NormalizedCard,
  NormalizedSet,
  SetSearchInput,
} from '../interfaces';
import { ProviderError } from '../errors';

const NAME = 'pokemontcg';
const BASE = 'https://api.pokemontcg.io/v2';

interface PtcgSet {
  id: string;
  name: string;
  series?: string;
  printedTotal?: number;
  total?: number;
  releaseDate?: string;
  images?: { symbol?: string; logo?: string };
}
interface PtcgCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  supertype?: string;
  subtypes?: string[];
  artist?: string;
  regulationMark?: string;
  set: { id: string };
  images?: { small?: string; large?: string };
}

export interface PokemonTcgAdapterOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export function createPokemonTcgCatalog(
  opts: PokemonTcgAdapterOptions = {},
): CardCatalogProvider {
  const doFetch = opts.fetchImpl ?? fetch;

  async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.apiKey) headers['X-Api-Key'] = opts.apiKey;
    let res: Response;
    try {
      res = await doFetch(`${BASE}${path}`, { headers, signal });
    } catch (cause) {
      throw new ProviderError('unavailable', NAME, 'Network error', { retryable: true, cause });
    }
    if (res.status === 429) {
      throw new ProviderError('rate_limited', NAME, 'Rate limited', { status: 429, retryable: true });
    }
    if (res.status === 404) {
      throw new ProviderError('not_found', NAME, 'Not found', { status: 404 });
    }
    if (!res.ok) {
      throw new ProviderError('bad_response', NAME, `HTTP ${res.status}`, {
        status: res.status,
        retryable: res.status >= 500,
      });
    }
    return (await res.json()) as T;
  }

  function normalizeSet(s: PtcgSet): NormalizedSet {
    return {
      externalId: s.id,
      provider: NAME,
      name: s.name,
      series: s.series ?? null,
      language: 'en',
      printedTotal: s.printedTotal ?? null,
      total: s.total ?? null,
      releaseDate: s.releaseDate ? s.releaseDate.replace(/\//g, '-') : null,
      symbolUrl: s.images?.symbol ?? null,
      logoUrl: s.images?.logo ?? null,
      metadata: { source: NAME },
    };
  }

  function normalizeCard(c: PtcgCard): NormalizedCard {
    return {
      externalId: c.id,
      provider: NAME,
      setExternalId: c.set.id,
      name: c.name,
      number: c.number,
      printedNumber: c.number,
      rarity: c.rarity ?? null,
      supertype: c.supertype ?? null,
      subtypes: c.subtypes ?? [],
      language: 'en',
      artist: c.artist ?? null,
      regulationMark: c.regulationMark ?? null,
      imageSmallUrl: c.images?.small ?? null,
      imageLargeUrl: c.images?.large ?? null,
      metadata: { source: NAME },
    };
  }

  return {
    name: NAME,
    async searchCards(input: CardSearchInput): Promise<CardSearchResult> {
      const page = input.cursor ? Number(input.cursor) : 1;
      // The API caps pageSize at 250; clamp so large set listings don't 400.
      const pageSize = Math.min(input.limit ?? 20, 250);
      const q = buildLucene(input);
      const path = `/cards?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}&orderBy=-set.releaseDate`;
      const body = await request<{ data: PtcgCard[]; totalCount: number }>(path);
      const cards = body.data.map(normalizeCard);
      const hasMore = page * pageSize < body.totalCount;
      return { cards, nextCursor: hasMore ? String(page + 1) : null };
    },
    async getCard(externalId: string): Promise<NormalizedCard> {
      const body = await request<{ data: PtcgCard }>(`/cards/${encodeURIComponent(externalId)}`);
      return normalizeCard(body.data);
    },
    async getSet(externalId: string): Promise<NormalizedSet> {
      const body = await request<{ data: PtcgSet }>(`/sets/${encodeURIComponent(externalId)}`);
      return normalizeSet(body.data);
    },
    async listSets(input: SetSearchInput): Promise<NormalizedSet[]> {
      const pageSize = input.limit ?? 100;
      const body = await request<{ data: PtcgSet[] }>(
        `/sets?orderBy=-releaseDate&pageSize=${pageSize}`,
      );
      return body.data.map(normalizeSet);
    },
  };
}

/** Build a Lucene-style query tolerant of "Charizard 199" and "199/165". */
export function buildLucene(input: CardSearchInput): string {
  const raw = input.query.trim();
  const parts: string[] = [];
  const numberSlash = raw.match(/(\d+)\s*\/\s*(\d+)/);
  const trailingNumber = raw.match(/\b(\d{1,3})\b\s*$/);
  const nameOnly = raw
    .replace(/(\d+)\s*\/\s*(\d+)/, '')
    .replace(/\b\d{1,3}\b\s*$/, '')
    .trim();

  if (nameOnly) parts.push(`name:"${nameOnly}*"`);
  if (numberSlash) {
    parts.push(`number:${numberSlash[1]}`);
  } else if (trailingNumber) {
    parts.push(`number:${trailingNumber[1]}`);
  }
  if (input.setExternalId) parts.push(`set.id:${input.setExternalId}`);
  return parts.length ? parts.join(' ') : `name:"${raw}*"`;
}
