import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  JobStore,
  RefreshTarget,
  PricePointWrite,
  ValuationItem,
  PortfolioSnapshotWrite,
  AlertRow,
  NotificationWrite,
  SyncRunWrite,
  PriceQuery,
} from './types';

/**
 * Live JobStore backed by Supabase Postgres (service-role client — bypasses RLS,
 * so it is used only in trusted job context). Requires the catalog to be synced
 * (`external_id_mappings` populated) so provider external ids resolve to internal
 * card UUIDs. Writes are idempotent via the DB's daily-price and
 * (user_id, snapshot_date) unique constraints.
 */
export class SupabaseJobStore implements JobStore {
  constructor(private readonly db: SupabaseClient) {}

  private async internalCardId(externalId: string): Promise<string | null> {
    const { data } = await this.db
      .from('external_id_mappings')
      .select('internal_id')
      .eq('entity_type', 'card')
      .eq('external_id', externalId)
      .limit(1)
      .maybeSingle();
    return (data?.internal_id as string) ?? null;
  }

  private async externalCardId(internalId: string): Promise<string | null> {
    const { data } = await this.db
      .from('external_id_mappings')
      .select('external_id')
      .eq('entity_type', 'card')
      .eq('internal_id', internalId)
      .limit(1)
      .maybeSingle();
    return (data?.external_id as string) ?? null;
  }

  async listRefreshTargets(limit: number): Promise<RefreshTarget[]> {
    // Priority: cards in any collection (100) or watchlist (60). One query each.
    const [{ data: owned }, { data: watched }] = await Promise.all([
      this.db.from('collection_items').select('card_id').limit(limit),
      this.db.from('watchlist_items').select('card_id').limit(limit),
    ]);
    const priority = new Map<string, number>();
    for (const row of watched ?? []) priority.set(row.card_id as string, 60);
    for (const row of owned ?? []) priority.set(row.card_id as string, 100);

    const targets: RefreshTarget[] = [];
    for (const [internalId, p] of priority) {
      const externalId = await this.externalCardId(internalId);
      if (externalId) {
        targets.push({
          cardExternalId: externalId,
          priority: p,
          reason: p === 100 ? 'collection' : 'watchlist',
        });
      }
    }
    return targets.slice(0, limit);
  }

  async upsertPricePoints(points: PricePointWrite[]): Promise<{ inserted: number; deduped: number }> {
    let inserted = 0;
    let deduped = 0;
    for (const p of points) {
      const cardId = await this.internalCardId(p.cardExternalId);
      if (!cardId) continue;
      const { error } = await this.db.from('price_points').upsert(
        {
          card_id: cardId,
          provider: p.provider,
          market: p.market,
          currency: p.currency,
          condition: p.condition ?? null,
          grading_company: p.gradingCompany ?? null,
          grade: p.grade ?? null,
          value_minor: p.valueMinor,
          low_value_minor: p.lowMinor ?? null,
          high_value_minor: p.highMinor ?? null,
          valuation_type: 'market',
          recorded_for_date: p.recordedForDate,
        },
        { onConflict: 'provider,card_id,market,currency,condition,grading_company,grade,recorded_for_date', ignoreDuplicates: false },
      );
      if (error) deduped += 1;
      else inserted += 1;
    }
    return { inserted, deduped };
  }

  async listUsersWithCollections(): Promise<string[]> {
    const { data } = await this.db.from('collections').select('user_id');
    return [...new Set((data ?? []).map((r) => r.user_id as string))];
  }

  async getValuationItems(userId: string): Promise<ValuationItem[]> {
    const { data } = await this.db
      .from('collection_items')
      .select('card_id, quantity, ownership_type, raw_condition, grading_company, grade, purchase_price_minor')
      .eq('user_id', userId);
    const items: ValuationItem[] = [];
    for (const row of data ?? []) {
      const externalId = await this.externalCardId(row.card_id as string);
      if (!externalId) continue;
      items.push({
        userId,
        cardExternalId: externalId,
        quantity: row.quantity as number,
        ownershipType: row.ownership_type as 'raw' | 'graded',
        gradingCompany: row.grading_company ?? undefined,
        grade: row.grade ?? undefined,
        rawCondition: row.raw_condition ?? undefined,
        purchasePriceMinor: (row.purchase_price_minor as number) ?? 0,
      });
    }
    return items;
  }

  async upsertPortfolioSnapshot(s: PortfolioSnapshotWrite): Promise<{ inserted: boolean }> {
    const { error } = await this.db.from('portfolio_snapshots').upsert(
      {
        user_id: s.userId,
        snapshot_date: s.snapshotDate,
        total_market_value_minor: s.totalMarketValueMinor,
        total_cost_basis_minor: s.totalCostBasisMinor,
        unrealized_gain_minor: s.unrealizedGainMinor,
        card_count: s.cardCount,
        graded_card_count: s.gradedCardCount,
        raw_card_count: s.rawCardCount,
      },
      { onConflict: 'user_id,snapshot_date' },
    );
    return { inserted: !error };
  }

  async listEnabledAlerts(): Promise<AlertRow[]> {
    const { data } = await this.db
      .from('price_alerts')
      .select('id, user_id, card_id, condition, grading_company, grade, direction, threshold, percentage_change, cadence, enabled, last_triggered_at')
      .eq('enabled', true);
    const alerts: AlertRow[] = [];
    for (const row of data ?? []) {
      const externalId = await this.externalCardId(row.card_id as string);
      if (!externalId) continue;
      alerts.push({
        id: row.id as string,
        userId: row.user_id as string,
        cardExternalId: externalId,
        direction: row.direction as AlertRow['direction'],
        threshold: row.threshold ?? undefined,
        percentageChange: row.percentage_change ?? undefined,
        condition: row.condition ?? undefined,
        gradingCompany: row.grading_company ?? undefined,
        grade: row.grade ?? undefined,
        cadence: (row.cadence as AlertRow['cadence']) ?? 'immediate',
        enabled: Boolean(row.enabled),
        lastTriggeredAt: row.last_triggered_at ?? undefined,
      });
    }
    return alerts;
  }

  async latestPriceMinor(query: PriceQuery): Promise<number | undefined> {
    const cardId = await this.internalCardId(query.cardExternalId);
    if (!cardId) return undefined;
    let q = this.db
      .from('price_points')
      .select('value_minor')
      .eq('card_id', cardId)
      .order('recorded_for_date', { ascending: false })
      .limit(1);
    if (query.gradingCompany) q = q.eq('grading_company', query.gradingCompany).eq('grade', query.grade ?? '');
    else if (query.condition) q = q.eq('condition', query.condition);
    const { data } = await q.maybeSingle();
    return (data?.value_minor as number) ?? undefined;
  }

  async priorPriceMinor(query: PriceQuery, daysAgo: number): Promise<number | undefined> {
    const cardId = await this.internalCardId(query.cardExternalId);
    if (!cardId) return undefined;
    const cutoff = new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
    const { data } = await this.db
      .from('price_points')
      .select('value_minor')
      .eq('card_id', cardId)
      .lte('recorded_for_date', cutoff)
      .order('recorded_for_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data?.value_minor as number) ?? undefined;
  }

  async createNotification(n: NotificationWrite): Promise<void> {
    await this.db.from('notifications').insert({
      user_id: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      action_url: n.actionUrl ?? null,
    });
  }

  async markAlertTriggered(alertId: string, at: string): Promise<void> {
    await this.db.from('price_alerts').update({ last_triggered_at: at }).eq('id', alertId);
  }

  async recordSyncRun(run: SyncRunWrite): Promise<void> {
    // Best-effort operational logging; never fail the job on a logging error.
    try {
      await this.db.from('provider_sync_runs').insert({
        provider: run.job,
        status: run.status,
        processed: run.processed,
        started_at: run.startedAt,
        finished_at: run.finishedAt,
        error_code: run.error ?? null,
      });
    } catch {
      /* ignore */
    }
  }
}
