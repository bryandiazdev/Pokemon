import 'server-only';
import { getServerSupabase } from '../supabase/server';
import { ensureCardPersisted, externalIdsForCards } from './canonical';

/**
 * Watchlist persistence. Same shape as the collection service: RLS-scoped
 * reads/writes through the session-bound client, canonical card persistence on
 * write so every watched card has a stable internal UUID.
 */

/** Hard cap per user — well above any real use, protects against abuse. */
const MAX_WATCHLIST_SIZE = 500;

export interface WatchlistRow {
  id: string;
  cardId: string;
  cardExternalId: string | null;
  name: string;
  number: string | null;
  setName: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export async function listWatchlist(userId: string): Promise<WatchlistRow[]> {
  try {
    const sb = await getServerSupabase();
    if (!sb) return [];
    const { data, error } = await sb
      .from('watchlist_items')
      .select('id, card_id, created_at, card:cards(name, number, image_small_url, image_large_url, set:sets(name))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[watchlist] listWatchlist failed:', error.message);
      return [];
    }
    const rows = data ?? [];
    const externalMap = await externalIdsForCards(rows.map((r) => r.card_id as string));
    return rows.map((r) => {
      const card = (r.card ?? {}) as {
        name?: string;
        number?: string;
        image_small_url?: string;
        image_large_url?: string;
        set?: { name?: string };
      };
      return {
        id: r.id as string,
        cardId: r.card_id as string,
        cardExternalId: externalMap.get(r.card_id as string) ?? null,
        name: card.name ?? 'Unknown card',
        number: card.number ?? null,
        setName: card.set?.name ?? null,
        imageUrl: card.image_small_url ?? card.image_large_url ?? null,
        createdAt: r.created_at as string,
      };
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[watchlist] listWatchlist threw:', err);
    return [];
  }
}

/** Whether the user watches this card. Never throws — enhancement only. */
export async function isWatched(userId: string, cardExternalId: string): Promise<boolean> {
  try {
    const rows = await listWatchlist(userId);
    return rows.some((r) => r.cardExternalId === cardExternalId);
  } catch {
    return false;
  }
}

/**
 * Add a card to the watchlist. Idempotent: watching an already-watched card
 * is a no-op, not an error.
 */
export async function addToWatchlist(
  userId: string,
  cardExternalId: string,
): Promise<{ id: string; already: boolean }> {
  const cardId = await ensureCardPersisted(cardExternalId);
  const sb = await getServerSupabase();
  if (!sb) throw new Error('Supabase not configured');

  const { data: existing } = await sb
    .from('watchlist_items')
    .select('id')
    .eq('user_id', userId)
    .eq('card_id', cardId)
    .limit(1)
    .maybeSingle();
  if (existing) return { id: existing.id as string, already: true };

  const { count } = await sb
    .from('watchlist_items')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((count ?? 0) >= MAX_WATCHLIST_SIZE) {
    throw new Error(`Watchlist is full (${MAX_WATCHLIST_SIZE} cards max).`);
  }

  const { data, error } = await sb
    .from('watchlist_items')
    .insert({ user_id: userId, card_id: cardId })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id as string, already: false };
}

/** Remove by watchlist item id. RLS enforces ownership; user_id is belt-and-braces. */
export async function removeFromWatchlist(userId: string, itemId: string): Promise<void> {
  const sb = await getServerSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { error } = await sb
    .from('watchlist_items')
    .delete()
    .eq('user_id', userId)
    .eq('id', itemId);
  if (error) throw error;
}

/** Remove by card external id (used by the card-page toggle). */
export async function unwatchCard(userId: string, cardExternalId: string): Promise<void> {
  const rows = await listWatchlist(userId);
  const match = rows.find((r) => r.cardExternalId === cardExternalId);
  if (match) await removeFromWatchlist(userId, match.id);
}
