import 'server-only';
import { randomBytes } from 'node:crypto';
import { getServerSupabase } from '../supabase/server';
import { getAdminSupabase } from '../supabase/admin';
import { ensureCardPersisted, externalIdsForCards } from './canonical';
import type { RawCondition, GradingCompany, OwnershipType } from '@psr/types';

/**
 * Real, RLS-scoped collection persistence. All reads/writes go through the
 * user's session-bound Supabase client, so RLS guarantees a user only ever
 * touches their own rows (defense in depth alongside the explicit user_id).
 */

export interface AddItemInput {
  cardExternalId: string;
  quantity: number;
  ownershipType: OwnershipType;
  rawCondition?: RawCondition;
  gradingCompany?: GradingCompany;
  grade?: string;
  purchasePriceMinor?: number;
  purchaseCurrency?: string;
  purchaseDate?: string | null;
  notes?: string | null;
  collectionId?: string;
}

export interface CollectionItemRow {
  id: string;
  cardId: string;
  cardExternalId: string | null;
  name: string;
  number: string | null;
  setName: string | null;
  imageUrl: string | null;
  quantity: number;
  ownershipType: OwnershipType;
  rawCondition: RawCondition | null;
  gradingCompany: GradingCompany | null;
  grade: string | null;
  purchasePriceMinor: number;
  purchaseCurrency: string;
}

export async function getOrCreateDefaultCollection(userId: string): Promise<string> {
  const sb = await getServerSupabase();
  if (!sb) throw new Error('Supabase not configured');

  const { data: existing } = await sb
    .from('collections')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await sb
    .from('collections')
    .insert({ user_id: userId, name: 'My Collection', is_default: true, visibility: 'private' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function listCollections(
  userId: string,
): Promise<Array<{ id: string; name: string; isDefault: boolean }>> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('collections')
    .select('id, name, is_default')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    isDefault: Boolean(r.is_default),
  }));
}

export async function addCollectionItem(
  userId: string,
  input: AddItemInput,
): Promise<{ id: string }> {
  // Canonicalize the card first (real internal UUID + provider mapping).
  const cardId = await ensureCardPersisted(input.cardExternalId);
  const collectionId = input.collectionId ?? (await getOrCreateDefaultCollection(userId));

  const sb = await getServerSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const graded = input.ownershipType === 'graded';

  const { data, error } = await sb
    .from('collection_items')
    .insert({
      collection_id: collectionId,
      user_id: userId,
      card_id: cardId,
      quantity: input.quantity,
      ownership_type: input.ownershipType,
      raw_condition: graded ? null : (input.rawCondition ?? 'near_mint'),
      grading_company: graded ? (input.gradingCompany ?? null) : null,
      grade: graded ? (input.grade ?? null) : null,
      purchase_price_minor: input.purchasePriceMinor ?? 0,
      purchase_currency: input.purchaseCurrency ?? 'USD',
      purchase_date: input.purchaseDate ?? null,
      notes: input.notes ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id as string };
}

export async function listCollectionItems(userId: string): Promise<CollectionItemRow[]> {
  try {
    const sb = await getServerSupabase();
    if (!sb) return [];
    const { data, error } = await sb
      .from('collection_items')
      .select(
        'id, card_id, quantity, ownership_type, raw_condition, grading_company, grade, purchase_price_minor, purchase_currency, card:cards(name, number, image_small_url, image_large_url, set:sets(name))',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[collection] listCollectionItems failed:', error.message);
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
        quantity: r.quantity as number,
        ownershipType: r.ownership_type as OwnershipType,
        rawCondition: (r.raw_condition as RawCondition | null) ?? null,
        gradingCompany: (r.grading_company as GradingCompany | null) ?? null,
        grade: (r.grade as string | null) ?? null,
        purchasePriceMinor: (r.purchase_price_minor as number) ?? 0,
        purchaseCurrency: (r.purchase_currency as string) ?? 'USD',
      };
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[collection] listCollectionItems threw:', err);
    return [];
  }
}

/**
 * Distinct external ids of every card the user owns (any condition/grade).
 * Lightweight — used to badge "owned" cards in set browsing, so it must never
 * fail a catalog page: errors degrade to an empty list.
 */
export async function listOwnedCardExternalIds(userId: string): Promise<string[]> {
  try {
    const sb = await getServerSupabase();
    if (!sb) return [];
    const { data, error } = await sb
      .from('collection_items')
      .select('card_id')
      .eq('user_id', userId);
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[collection] listOwnedCardExternalIds failed:', error.message);
      return [];
    }
    const cardIds = [...new Set((data ?? []).map((r) => r.card_id as string))];
    if (cardIds.length === 0) return [];
    const externalMap = await externalIdsForCards(cardIds);
    return cardIds
      .map((id) => externalMap.get(id))
      .filter((id): id is string => Boolean(id));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[collection] listOwnedCardExternalIds threw:', err);
    return [];
  }
}

export async function deleteCollectionItem(userId: string, itemId: string): Promise<void> {
  const sb = await getServerSupabase();
  if (!sb) throw new Error('Supabase not configured');
  // RLS also enforces ownership; the explicit user_id filter is belt-and-braces.
  const { error } = await sb.from('collection_items').delete().eq('id', itemId).eq('user_id', userId);
  if (error) throw error;
}

// ---------- Collection sharing (read-only public links) ----------

export interface ShareState {
  enabled: boolean;
  slug: string | null;
}

export async function getShareState(userId: string): Promise<ShareState> {
  const sb = await getServerSupabase();
  if (!sb) return { enabled: false, slug: null };
  const collectionId = await getOrCreateDefaultCollection(userId);
  const { data } = await sb
    .from('collections')
    .select('visibility, share_slug')
    .eq('id', collectionId)
    .single();
  const enabled = data?.visibility === 'unlisted' && Boolean(data?.share_slug);
  return { enabled, slug: enabled ? (data!.share_slug as string) : null };
}

/**
 * Toggle sharing for the user's default collection. Enabling mints a fresh
 * unguessable slug; disabling clears it so previously shared links stop
 * working permanently (privacy-first: no resurrecting an old link by
 * accident).
 */
export async function setShareEnabled(userId: string, enabled: boolean): Promise<ShareState> {
  const sb = await getServerSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const collectionId = await getOrCreateDefaultCollection(userId);

  if (!enabled) {
    const { error } = await sb
      .from('collections')
      .update({ visibility: 'private', share_slug: null })
      .eq('id', collectionId)
      .eq('user_id', userId);
    if (error) throw error;
    return { enabled: false, slug: null };
  }

  // 12 URL-safe chars from 9 random bytes — unguessable, short enough to share.
  const slug = randomBytes(9).toString('base64url');
  const { error } = await sb
    .from('collections')
    .update({ visibility: 'unlisted', share_slug: slug })
    .eq('id', collectionId)
    .eq('user_id', userId);
  if (error) throw error;
  return { enabled: true, slug };
}

export interface SharedCollection {
  ownerName: string;
  collectionName: string;
  items: CollectionItemRow[];
}

/**
 * Resolve a share slug to its collection — public read path (no auth). Uses
 * the service-role client because the viewer has no session; the slug +
 * visibility check IS the authorization. Only non-financial fields leave this
 * function: never expose cost basis or purchase data on a public page.
 */
export async function getSharedCollection(slug: string): Promise<SharedCollection | null> {
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(slug)) return null;
  const admin = getAdminSupabase();
  if (!admin) return null;

  const { data: collection } = await admin
    .from('collections')
    .select('id, name, user_id, visibility')
    .eq('share_slug', slug)
    .maybeSingle();
  if (!collection || collection.visibility === 'private') return null;

  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', collection.user_id as string)
    .maybeSingle();

  const { data: rows } = await admin
    .from('collection_items')
    .select(
      'id, card_id, quantity, ownership_type, raw_condition, grading_company, grade, card:cards(name, number, image_small_url, image_large_url, set:sets(name))',
    )
    .eq('collection_id', collection.id as string)
    .order('created_at', { ascending: false });

  const externalMap = await externalIdsForCards((rows ?? []).map((r) => r.card_id as string));

  const items: CollectionItemRow[] = (rows ?? []).map((r) => {
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
      quantity: r.quantity as number,
      ownershipType: r.ownership_type as OwnershipType,
      rawCondition: (r.raw_condition as RawCondition | null) ?? null,
      gradingCompany: (r.grading_company as GradingCompany | null) ?? null,
      grade: (r.grade as string | null) ?? null,
      // Financial fields intentionally zeroed on the public path.
      purchasePriceMinor: 0,
      purchaseCurrency: 'USD',
    };
  });

  return {
    ownerName: (profile?.display_name as string | null) ?? 'A collector',
    collectionName: (collection.name as string) ?? 'My Collection',
    items,
  };
}
