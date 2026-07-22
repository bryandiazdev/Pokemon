import 'server-only';
import { getServerSupabase } from '../supabase/server';
import { ensureCardPersisted, externalIdsForCards } from './canonical';
import type { RawCondition, GradingCompany } from '@psr/types';

/**
 * Price-alert persistence. RLS-scoped like the collection/watchlist services;
 * plan gating (checkAlertCreate) happens in the API route BEFORE these are
 * called. Thresholds are integer minor units (cents) end-to-end — the same
 * unit the evaluation job and the price_alerts column use.
 */

export type AlertDirection = 'above' | 'below' | 'pct_increase' | 'pct_decrease';
export type AlertCadence = 'immediate' | 'daily' | 'weekly';

export interface AlertInput {
  cardExternalId: string;
  direction: AlertDirection;
  /** Required for above/below. Minor units (cents). */
  thresholdMinor?: number;
  /** Required for pct_increase/pct_decrease. Percent, e.g. 20 = 20%. */
  percentageChange?: number;
  condition?: RawCondition;
  gradingCompany?: GradingCompany;
  grade?: string;
  cadence?: AlertCadence;
}

export interface AlertRow {
  id: string;
  cardExternalId: string | null;
  name: string;
  number: string | null;
  setName: string | null;
  imageUrl: string | null;
  direction: AlertDirection;
  thresholdMinor: number | null;
  percentageChange: number | null;
  condition: RawCondition | null;
  gradingCompany: GradingCompany | null;
  grade: string | null;
  cadence: AlertCadence;
  enabled: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export async function listAlerts(userId: string): Promise<AlertRow[]> {
  try {
    const sb = await getServerSupabase();
    if (!sb) return [];
    const { data, error } = await sb
      .from('price_alerts')
      .select(
        'id, card_id, direction, threshold, percentage_change, condition, grading_company, grade, cadence, enabled, last_triggered_at, created_at, card:cards(name, number, image_small_url, image_large_url, set:sets(name))',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[alerts] listAlerts failed:', error.message);
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
        cardExternalId: externalMap.get(r.card_id as string) ?? null,
        name: card.name ?? 'Unknown card',
        number: card.number ?? null,
        setName: card.set?.name ?? null,
        imageUrl: card.image_small_url ?? card.image_large_url ?? null,
        direction: r.direction as AlertDirection,
        thresholdMinor: (r.threshold as number | null) ?? null,
        percentageChange:
          r.percentage_change != null ? Number(r.percentage_change) : null,
        condition: (r.condition as RawCondition | null) ?? null,
        gradingCompany: (r.grading_company as GradingCompany | null) ?? null,
        grade: r.grade != null ? String(r.grade) : null,
        cadence: (r.cadence as AlertCadence) ?? 'immediate',
        enabled: Boolean(r.enabled),
        lastTriggeredAt: (r.last_triggered_at as string | null) ?? null,
        createdAt: r.created_at as string,
      };
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[alerts] listAlerts threw:', err);
    return [];
  }
}

export async function createAlert(userId: string, input: AlertInput): Promise<{ id: string }> {
  const absolute = input.direction === 'above' || input.direction === 'below';
  if (absolute && (input.thresholdMinor == null || input.thresholdMinor < 0)) {
    throw new Error('Above/below alerts need a target price.');
  }
  if (!absolute && (input.percentageChange == null || input.percentageChange <= 0)) {
    throw new Error('Percentage alerts need a percent change.');
  }

  const cardId = await ensureCardPersisted(input.cardExternalId);
  const sb = await getServerSupabase();
  if (!sb) throw new Error('Supabase not configured');

  const graded = Boolean(input.gradingCompany && input.grade);
  const { data, error } = await sb
    .from('price_alerts')
    .insert({
      user_id: userId,
      card_id: cardId,
      direction: input.direction,
      threshold: absolute ? Math.round(input.thresholdMinor!) : null,
      percentage_change: absolute ? null : input.percentageChange,
      condition: graded ? null : (input.condition ?? 'near_mint'),
      grading_company: graded ? input.gradingCompany : null,
      grade: graded ? input.grade : null,
      cadence: input.cadence ?? 'immediate',
      enabled: true,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id as string };
}

export async function setAlertEnabled(
  userId: string,
  alertId: string,
  enabled: boolean,
): Promise<void> {
  const sb = await getServerSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { error } = await sb
    .from('price_alerts')
    .update({ enabled })
    .eq('user_id', userId)
    .eq('id', alertId);
  if (error) throw error;
}

export async function deleteAlert(userId: string, alertId: string): Promise<void> {
  const sb = await getServerSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { error } = await sb
    .from('price_alerts')
    .delete()
    .eq('user_id', userId)
    .eq('id', alertId);
  if (error) throw error;
}
