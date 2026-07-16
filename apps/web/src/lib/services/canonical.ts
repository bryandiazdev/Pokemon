import 'server-only';
import { getAdminSupabase } from '../supabase/admin';
import { getRegistry } from '../providers';

/**
 * Canonical catalog persistence (lazy, on-demand).
 *
 * The catalog is served LIVE from the provider (TCGdex), but the DB needs a
 * canonical row with a stable internal UUID whenever a user references a card
 * (collection item, watchlist, alert, scan). This upserts the set + card from
 * the provider into our own `sets`/`cards` tables and records an
 * `external_id_mappings` row, returning the internal card UUID.
 *
 * Uses the service-role client because catalog tables are service-write only
 * (RLS denies writes to anon/authenticated). Idempotent: repeat calls return the
 * existing internal id.
 */

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

async function existingInternalId(
  entityType: 'card' | 'set',
  externalId: string,
): Promise<string | null> {
  const admin = getAdminSupabase();
  if (!admin) return null;
  const { data } = await admin
    .from('external_id_mappings')
    .select('internal_id')
    .eq('entity_type', entityType)
    .eq('external_id', externalId)
    .limit(1)
    .maybeSingle();
  return (data?.internal_id as string) ?? null;
}

export async function ensureSetPersisted(setExternalId: string): Promise<string> {
  const admin = getAdminSupabase();
  if (!admin) throw new Error('Supabase not configured');

  const found = await existingInternalId('set', setExternalId);
  if (found) return found;

  const set = await getRegistry().call('catalog', 'getSet', (a) => a.getSet(setExternalId));
  const slug = slugify(`${set.name}-${set.language}-${setExternalId}`);

  const { data, error } = await admin
    .from('sets')
    .upsert(
      {
        name: set.name,
        series: set.series,
        language: set.language,
        printed_total: set.printedTotal,
        total: set.total,
        release_date: set.releaseDate,
        symbol_url: set.symbolUrl,
        logo_url: set.logoUrl,
        canonical_slug: slug,
        metadata: { source: set.provider },
      },
      { onConflict: 'canonical_slug' },
    )
    .select('id')
    .single();
  if (error) throw error;
  const setId = data.id as string;

  await admin.from('external_id_mappings').upsert(
    {
      entity_type: 'set',
      internal_id: setId,
      provider: set.provider,
      external_id: setExternalId,
    },
    { onConflict: 'provider,entity_type,external_id' },
  );
  return setId;
}

export async function ensureCardPersisted(cardExternalId: string): Promise<string> {
  const admin = getAdminSupabase();
  if (!admin) throw new Error('Supabase not configured');

  const found = await existingInternalId('card', cardExternalId);
  if (found) return found;

  const card = await getRegistry().call('catalog', 'getCard', (a) => a.getCard(cardExternalId));
  const setId = await ensureSetPersisted(card.setExternalId);
  const slug = slugify(`${card.name}-${card.setExternalId}-${card.number}`);

  const { data, error } = await admin
    .from('cards')
    .upsert(
      {
        set_id: setId,
        name: card.name,
        number: card.number,
        printed_number: card.printedNumber,
        rarity: card.rarity,
        supertype: card.supertype,
        subtypes: card.subtypes,
        language: card.language,
        artist: card.artist,
        regulation_mark: card.regulationMark,
        image_small_url: card.imageSmallUrl,
        image_large_url: card.imageLargeUrl,
        canonical_slug: slug,
        metadata: { source: card.provider },
      },
      { onConflict: 'canonical_slug' },
    )
    .select('id')
    .single();
  if (error) throw error;
  const cardId = data.id as string;

  await admin.from('external_id_mappings').upsert(
    {
      entity_type: 'card',
      internal_id: cardId,
      provider: card.provider,
      external_id: cardExternalId,
    },
    { onConflict: 'provider,entity_type,external_id' },
  );
  return cardId;
}

/** Resolve internal card UUIDs back to their provider external ids (for pricing). */
export async function externalIdsForCards(
  cardIds: string[],
): Promise<Map<string, string>> {
  const admin = getAdminSupabase();
  const out = new Map<string, string>();
  if (!admin || cardIds.length === 0) return out;
  const { data } = await admin
    .from('external_id_mappings')
    .select('internal_id, external_id')
    .eq('entity_type', 'card')
    .in('internal_id', cardIds);
  for (const row of data ?? []) out.set(row.internal_id as string, row.external_id as string);
  return out;
}
