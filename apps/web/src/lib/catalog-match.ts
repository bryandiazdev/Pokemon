import type { NormalizedSet } from '@psr/providers';

/** Client-safe set matcher used by the sets explorer grid + typeahead. */
export function matchSets(sets: NormalizedSet[], query: string): NormalizedSet[] {
  const q = query.toLowerCase().trim();
  if (!q) return sets;

  return sets
    .map((set) => {
      const year = set.releaseDate?.slice(0, 4) ?? '';
      const hay = `${set.name} ${set.series ?? ''} ${year} ${set.language}`.toLowerCase();
      let score = 0;
      if (hay.includes(q)) score += 1;
      if (set.name.toLowerCase().startsWith(q)) score += 0.6;
      for (const term of q.split(/\s+/)) {
        if (term && hay.includes(term)) score += 0.4;
      }
      return { set, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.set);
}
