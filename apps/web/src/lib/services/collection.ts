import 'server-only';
import { getServerSupabase } from '../supabase/server';
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

export async function deleteCollectionItem(userId: string, itemId: string): Promise<void> {
  const sb = await getServerSupabase();
  if (!sb) throw new Error('Supabase not configured');
  // RLS also enforces ownership; the explicit user_id filter is belt-and-braces.
  const { error } = await sb.from('collection_items').delete().eq('id', itemId).eq('user_id', userId);
  if (error) throw error;
}
