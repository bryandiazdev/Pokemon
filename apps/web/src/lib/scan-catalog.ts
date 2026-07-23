import 'server-only';
import type { NormalizedSet } from '@psr/providers';
import { getRegistry } from './providers';
import { matchSets } from './catalog-match';

/**
 * Shared catalog-resolution helpers for the scan routes (single + batch):
 * set-name → set-id scoping and vision-language → catalog-language mapping.
 */

export const isImageDataUrl = (ref: string): boolean =>
  /^data:image\/[a-z+.-]+;base64,/i.test(ref);

// Set catalog cache for set-name resolution — sets change rarely.
let setsCache: { at: number; sets: NormalizedSet[] } | null = null;
const SETS_TTL_MS = 10 * 60_000;

export async function listSetsCached(): Promise<NormalizedSet[]> {
  if (setsCache && Date.now() - setsCache.at < SETS_TTL_MS) return setsCache.sets;
  const sets = await getRegistry().call('catalog', 'listSets', (a) => a.listSets({}));
  setsCache = { at: Date.now(), sets };
  return sets;
}

/**
 * Resolve the printed set to a catalog set id using the set name and/or the
 * printed total ("4/102" → 102). Returns undefined rather than guessing:
 * name matches are validated against the total when both are available.
 */
export async function resolveSetExternalId(
  setName: string | null,
  setTotal: string | null,
): Promise<string | undefined> {
  if (!setName && !setTotal) return undefined;
  let sets: NormalizedSet[];
  try {
    sets = await listSetsCached();
  } catch {
    return undefined; // set scoping is an optimization, never a failure source
  }
  const total = setTotal ? parseInt(setTotal, 10) : NaN;

  if (setName) {
    const matches = matchSets(sets, setName);
    if (matches.length === 0) return undefined;
    if (!Number.isNaN(total)) {
      const confirmed = matches.find((s) => s.printedTotal === total || s.total === total);
      if (confirmed) return confirmed.externalId;
    }
    return matches[0]!.externalId;
  }

  // Total only: use it when it identifies exactly one set — otherwise it's
  // ambiguous (many sets share a printed total) and we skip scoping.
  const byTotal = sets.filter((s) => s.printedTotal === total || s.total === total);
  return byTotal.length === 1 ? byTotal[0]!.externalId : undefined;
}

/**
 * The vision model emits ISO 639-1; TCGdex uses dialect-scoped catalogs for
 * Chinese and plain codes elsewhere.
 */
export function mapVisionLanguage(language: string | null | undefined): string | undefined {
  if (!language) return undefined;
  const langMap: Record<string, string> = { zh: 'zh-cn', 'pt-br': 'pt' };
  return langMap[language] ?? language;
}
