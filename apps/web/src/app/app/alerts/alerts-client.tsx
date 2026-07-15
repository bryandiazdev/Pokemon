'use client';
import { useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Plus } from 'lucide-react';

interface Alert {
  id: string;
  cardExternalId: string;
  direction: string;
  threshold?: number;
  cadence: string;
}

const SEED: Alert[] = [
  { id: 'a1', cardExternalId: 'base1-4', direction: 'above', threshold: 400, cadence: 'immediate' },
  { id: 'a2', cardExternalId: 'sv4pt5-193', direction: 'below', threshold: 90, cadence: 'daily' },
];

export function AlertsClient() {
  const [alerts, setAlerts] = useState<Alert[]>(SEED);
  const [showForm, setShowForm] = useState(false);
  const [card, setCard] = useState('base1-4');
  const [direction, setDirection] = useState('above');
  const [threshold, setThreshold] = useState(100);
  const [error, setError] = useState('');

  async function create() {
    setError('');
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardExternalId: card, direction, threshold, cadence: 'immediate' }),
    });
    const body = await res.json();
    if (!body.success) {
      setError(body.error.message);
      return;
    }
    setAlerts((a) => [body.data.alert, ...a]);
    setShowForm(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus size={16} /> New alert
        </Button>
      </div>

      {showForm && (
        <Card className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-xs text-muted">Card</span>
            <select className="psr-input" value={card} onChange={(e) => setCard(e.target.value)}>
              <option value="base1-4">Charizard — Base Set</option>
              <option value="sv4pt5-193">Mew ex — Paldean Fates</option>
              <option value="base1-58">Pikachu — Base Set</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Direction</span>
            <select className="psr-input" value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="above">Price above</option>
              <option value="below">Price below</option>
              <option value="pct_increase">% increase</option>
              <option value="pct_decrease">% decrease</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Threshold ($)</span>
            <input type="number" className="psr-input" value={threshold} onChange={(e) => setThreshold(+e.target.value)} />
          </label>
          <div className="sm:col-span-4">
            {error && <p className="mb-2 text-xs text-negative">{error}</p>}
            <Button onClick={create}>Create alert</Button>
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>Active alerts</CardTitle>
        <ul className="mt-2 divide-y divide-border">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-accent" />
                <span>
                  {a.cardExternalId} — {a.direction.replace('_', ' ')}{' '}
                  {a.threshold ? `$${a.threshold}` : ''}
                </span>
              </div>
              <Badge tone="info">{a.cadence}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-xs text-muted">
        Alerts are delivered in-app and by email, with cooldowns and digests to prevent spam.
      </p>
    </div>
  );
}
