'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AlertRow } from '@/lib/services/alerts';
import { RAW_CONDITIONS, GRADING_COMPANIES } from '@psr/types';
import { Bell, Plus, Search, Trash2, ImageIcon } from 'lucide-react';

export interface PrefillCard {
  externalId: string;
  name: string;
  number: string | null;
}

interface SearchHit {
  externalId: string;
  name: string;
  number: string | null;
  setExternalId: string;
  imageSmallUrl: string | null;
}

const DIRECTION_LABEL: Record<AlertRow['direction'], string> = {
  above: 'Price at or above',
  below: 'Price at or below',
  pct_increase: 'Up at least',
  pct_decrease: 'Down at least',
};

function ruleText(a: AlertRow): string {
  const scope =
    a.gradingCompany && a.grade
      ? `${a.gradingCompany.toUpperCase()} ${a.grade}`
      : (a.condition ?? 'near_mint').replace(/_/g, ' ');
  const target =
    a.direction === 'above' || a.direction === 'below'
      ? `$${((a.thresholdMinor ?? 0) / 100).toFixed(2)}`
      : `${a.percentageChange ?? 0}% in 7 days`;
  return `${DIRECTION_LABEL[a.direction]} ${target} · ${scope}`;
}

export function AlertsManager({
  initialAlerts,
  used,
  limit,
  plan,
  prefill,
}: {
  initialAlerts: AlertRow[];
  used: number;
  limit: number;
  plan: string;
  prefill: PrefillCard | null;
}) {
  const router = useRouter();
  const unlimited = limit < 0;
  const atLimit = !unlimited && used >= limit;
  const noAlertPlan = limit === 0;

  const [open, setOpen] = useState(Boolean(prefill) && !noAlertPlan);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [upgrade, setUpgrade] = useState(false);

  // Card picker
  const [picked, setPicked] = useState<PrefillCard | null>(prefill);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rule
  const [direction, setDirection] = useState<AlertRow['direction']>('below');
  const [price, setPrice] = useState('');
  const [percent, setPercent] = useState('20');
  const [scope, setScope] = useState<'raw' | 'graded'>('raw');
  const [condition, setCondition] = useState('near_mint');
  const [company, setCompany] = useState('psa');
  const [grade, setGrade] = useState('10');
  const [cadence, setCadence] = useState('immediate');

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  function search(q: string) {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q.trim())}&types=cards&limit=8`,
        );
        const body = await res.json();
        setHits(body.success ? (body.data.cards ?? []) : []);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setUpgrade(false);
    if (!picked) {
      setError('Pick a card first.');
      return;
    }
    const absolute = direction === 'above' || direction === 'below';
    const priceNum = Number(price);
    if (absolute && (!price || Number.isNaN(priceNum) || priceNum <= 0)) {
      setError('Enter a target price in dollars.');
      return;
    }
    const pctNum = Number(percent);
    if (!absolute && (Number.isNaN(pctNum) || pctNum <= 0)) {
      setError('Enter a percent change.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardExternalId: picked.externalId,
          direction,
          thresholdMinor: absolute ? Math.round(priceNum * 100) : undefined,
          percentageChange: absolute ? undefined : pctNum,
          condition: scope === 'raw' ? condition : undefined,
          gradingCompany: scope === 'graded' ? company : undefined,
          grade: scope === 'graded' ? grade : undefined,
          cadence,
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? 'Could not create the alert.');
        setUpgrade(res.status === 402);
        return;
      }
      setOpen(false);
      setPicked(null);
      setQuery('');
      setPrice('');
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(alert: AlertRow) {
    setError('');
    setUpgrade(false);
    try {
      const res = await fetch(`/api/alerts/${encodeURIComponent(alert.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !alert.enabled }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? 'Could not update the alert.');
        setUpgrade(res.status === 402);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error — try again.');
    }
  }

  async function remove(alert: AlertRow) {
    setError('');
    try {
      const res = await fetch(`/api/alerts/${encodeURIComponent(alert.id)}`, {
        method: 'DELETE',
      });
      const body = await res.json();
      if (body.success) router.refresh();
      else setError(body.error?.message ?? 'Could not delete the alert.');
    } catch {
      setError('Network error — try again.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted">
          {unlimited
            ? `${used} active alert${used === 1 ? '' : 's'}`
            : `${used} of ${limit} alert${limit === 1 ? '' : 's'} used`}
        </span>
        {!noAlertPlan && (
          <Button onClick={() => setOpen((s) => !s)} disabled={atLimit && !open}>
            <Plus size={16} /> New alert
          </Button>
        )}
      </div>

      {noAlertPlan && (
        <Card>
          <div className="flex flex-col items-start gap-2 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Bell size={15} className="text-accent" aria-hidden /> Alerts are a Collector
              feature
            </span>
            <p className="text-muted">
              Upgrade to set price targets on any card — 25 alerts on Collector, 250 on Pro.
            </p>
            <Link
              href="/pricing"
              className="inline-flex min-h-[38px] items-center rounded-lg bg-accent px-4 text-sm font-medium text-bg transition-colors hover:bg-accent-strong"
            >
              See plans
            </Link>
          </div>
        </Card>
      )}

      {atLimit && !noAlertPlan && (
        <p className="text-xs text-warning">
          You&rsquo;ve reached your plan&rsquo;s alert limit.{' '}
          {plan === 'collector' ? (
            <Link href="/pricing" className="text-accent underline-offset-2 hover:underline">
              Pro raises it to 250.
            </Link>
          ) : (
            'Remove an alert to add another.'
          )}
        </p>
      )}

      {error && (
        <p className="text-sm text-warning">
          {error}{' '}
          {upgrade && (
            <Link href="/pricing" className="text-accent underline-offset-2 hover:underline">
              See plans
            </Link>
          )}
        </p>
      )}

      {open && (
        <Card>
          <form onSubmit={create} className="space-y-3">
            <CardTitle>New alert</CardTitle>

            {picked ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent/8 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {picked.name}
                  {picked.number ? ` · #${picked.number}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  className="shrink-0 text-xs text-muted hover:text-content"
                >
                  Change card
                </button>
              </div>
            ) : (
              <div className="relative">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-muted">Card</span>
                  <span className="relative block">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
                      aria-hidden
                    />
                    <input
                      value={query}
                      onChange={(e) => search(e.target.value)}
                      placeholder="Search by name — e.g. Mega Darkrai ex"
                      className="psr-input pl-8"
                    />
                  </span>
                </label>
                {(hits.length > 0 || searching) && query.trim().length >= 2 && (
                  <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-bg-deep shadow-xl">
                    {searching && hits.length === 0 && (
                      <li className="px-3 py-2 text-xs text-muted">Searching…</li>
                    )}
                    {hits.map((hit) => (
                      <li key={hit.externalId}>
                        <button
                          type="button"
                          onClick={() => {
                            setPicked({
                              externalId: hit.externalId,
                              name: hit.name,
                              number: hit.number,
                            });
                            setHits([]);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-elevated"
                        >
                          {hit.imageSmallUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={hit.imageSmallUrl}
                              alt=""
                              className="h-9 w-7 shrink-0 rounded object-contain"
                            />
                          ) : (
                            <span className="flex h-9 w-7 shrink-0 items-center justify-center rounded bg-surface-elevated text-faint">
                              <ImageIcon size={12} aria-hidden />
                            </span>
                          )}
                          <span className="min-w-0 truncate">
                            {hit.name}
                            {hit.number ? ` · #${hit.number}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted">Trigger</span>
                <select
                  className="psr-input"
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as AlertRow['direction'])}
                >
                  <option value="below">Price below</option>
                  <option value="above">Price above</option>
                  <option value="pct_increase">Up X% (7d)</option>
                  <option value="pct_decrease">Down X% (7d)</option>
                </select>
              </label>

              {direction === 'above' || direction === 'below' ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-muted">Target ($)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="50.00"
                    className="psr-input"
                  />
                </label>
              ) : (
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-muted">Percent (%)</span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="1000"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                    className="psr-input"
                  />
                </label>
              )}

              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted">Watching</span>
                <select
                  className="psr-input"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as 'raw' | 'graded')}
                >
                  <option value="raw">Raw price</option>
                  <option value="graded">Graded price</option>
                </select>
              </label>

              {scope === 'raw' ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-muted">Condition</span>
                  <select
                    className="psr-input"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                  >
                    {RAW_CONDITIONS.filter((c) => c !== 'unspecified').map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="grid grid-cols-2 gap-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs text-muted">Company</span>
                    <select
                      className="psr-input"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    >
                      {GRADING_COMPANIES.map((c) => (
                        <option key={c} value={c}>
                          {c.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs text-muted">Grade</span>
                    <input
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder="10"
                      className="psr-input"
                    />
                  </label>
                </span>
              )}
            </div>

            <label className="block max-w-[12rem] text-sm">
              <span className="mb-1 block text-xs text-muted">Cadence</span>
              <select
                className="psr-input"
                value={cadence}
                onChange={(e) => setCadence(e.target.value)}
              >
                <option value="immediate">Immediate</option>
                <option value="daily">Daily digest</option>
                <option value="weekly">Weekly digest</option>
              </select>
            </label>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create alert'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <CardTitle>Your alerts</CardTitle>
        {initialAlerts.length === 0 ? (
          <p className="mt-3 py-4 text-center text-sm text-muted">
            No alerts yet.{' '}
            {noAlertPlan
              ? 'Upgrade to Collector to create your first one.'
              : 'Create one above, or use the bell on any card page.'}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {initialAlerts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                {a.cardExternalId ? (
                  <Link
                    href={`/cards/${a.cardExternalId}`}
                    className="flex min-w-0 flex-1 items-center gap-3 hover:text-accent"
                  >
                    <AlertRowBody alert={a} />
                  </Link>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <AlertRowBody alert={a} />
                  </span>
                )}
                <button
                  type="button"
                  role="switch"
                  aria-checked={a.enabled}
                  aria-label={`${a.enabled ? 'Disable' : 'Enable'} alert for ${a.name}`}
                  onClick={() => void toggle(a)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    a.enabled ? 'bg-accent' : 'bg-surface-elevated'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-bg transition-all ${
                      a.enabled ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => void remove(a)}
                  aria-label={`Delete alert for ${a.name}`}
                  title="Delete alert"
                  className="shrink-0 rounded p-1.5 text-muted transition-colors hover:bg-surface-elevated hover:text-negative"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AlertRowBody({ alert }: { alert: AlertRow }) {
  return (
    <>
      {alert.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={alert.imageUrl}
          alt={alert.name}
          loading="lazy"
          decoding="async"
          className="h-12 w-9 shrink-0 rounded object-contain"
        />
      ) : (
        <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded bg-bg-deep/60 text-faint">
          <Bell size={13} aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {alert.name}
          {alert.number ? <span className="text-muted"> · #{alert.number}</span> : null}
        </span>
        <span className="block truncate text-xs text-muted">{ruleText(alert)}</span>
        {alert.lastTriggeredAt && (
          <span className="block text-[11px] text-faint">
            Last triggered {new Date(alert.lastTriggeredAt).toLocaleDateString()}
          </span>
        )}
      </span>
      {!alert.enabled && <Badge tone="neutral">Paused</Badge>}
    </>
  );
}
