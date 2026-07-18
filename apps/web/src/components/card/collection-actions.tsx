'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RemoveItemButton } from '@/components/collection/remove-item-button';
import { RAW_CONDITIONS, GRADING_COMPANIES } from '@psr/types';
import { Plus, Check, Layers } from 'lucide-react';

export interface OwnedCopy {
  id: string;
  quantity: number;
  label: string;
}

/**
 * Add/remove-from-collection panel for a card detail page. The server passes
 * the signed-in user's existing copies of this card; adding refreshes the
 * page so the owned list stays server-authoritative.
 */
export function CollectionActions({
  cardExternalId,
  cardName,
  owned,
  signedIn,
}: {
  cardExternalId: string;
  cardName: string;
  owned: OwnedCopy[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [added, setAdded] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [ownership, setOwnership] = useState<'raw' | 'graded'>('raw');
  const [condition, setCondition] = useState('near_mint');
  const [company, setCompany] = useState('psa');
  const [grade, setGrade] = useState('');
  const [price, setPrice] = useState('');

  if (!signedIn) {
    return (
      <div className="rounded-lg border border-border bg-bg-deep/30 p-3 text-sm text-muted">
        <Link href="/sign-in" className="text-accent hover:underline">
          Sign in
        </Link>{' '}
        to track this card in your collection.
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ownership === 'graded' && !grade.trim()) {
      setMessage('Graded copies need a grade.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/collection/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardExternalId,
          quantity,
          ownershipType: ownership,
          rawCondition: ownership === 'raw' ? condition : undefined,
          gradingCompany: ownership === 'graded' ? company : undefined,
          grade: ownership === 'graded' ? grade.trim() : undefined,
          purchasePriceMajor: price ? Number(price) : undefined,
          purchaseCurrency: 'USD',
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setMessage(body.error?.message ?? 'Could not add the card.');
        return;
      }
      setAdded(true);
      setOpen(false);
      setGrade('');
      setPrice('');
      router.refresh();
    } catch {
      setMessage('Network error — try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-bg-deep/30 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Layers size={15} className="text-accent" aria-hidden />
        Your collection
      </div>

      {owned.length > 0 ? (
        <ul className="space-y-2">
          {owned.map((copy) => (
            <li key={copy.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <Badge tone={/PSA|BGS|CGC|SGC|TAG|ACE/i.test(copy.label) ? 'gold' : 'neutral'}>
                  {copy.label}
                </Badge>
                {copy.quantity > 1 && (
                  <span className="font-mono text-xs text-muted">×{copy.quantity}</span>
                )}
              </span>
              <RemoveItemButton itemId={copy.id} label={cardName} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Not in your collection yet.</p>
      )}

      {added && (
        <p className="flex items-center gap-1.5 text-sm text-positive">
          <Check size={14} aria-hidden /> Added to your collection.
        </p>
      )}
      {message && <p className="text-sm text-warning">{message}</p>}

      {!open ? (
        <Button size="sm" onClick={() => { setOpen(true); setAdded(false); }}>
          <Plus size={14} /> Add to collection
        </Button>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs">
              <span className="mb-1 block text-muted">Quantity</span>
              <input
                type="number"
                min={1}
                max={10000}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="psr-input"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted">Ownership</span>
              <select
                value={ownership}
                onChange={(e) => setOwnership(e.target.value as 'raw' | 'graded')}
                className="psr-input"
              >
                <option value="raw">Raw</option>
                <option value="graded">Graded</option>
              </select>
            </label>

            {ownership === 'raw' ? (
              <label className="col-span-2 block text-xs">
                <span className="mb-1 block text-muted">Condition</span>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="psr-input"
                >
                  {RAW_CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="block text-xs">
                  <span className="mb-1 block text-muted">Company</span>
                  <select
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="psr-input"
                  >
                    {GRADING_COMPANIES.map((c) => (
                      <option key={c} value={c}>
                        {c.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block text-muted">Grade</span>
                  <input
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="10"
                    className="psr-input"
                  />
                </label>
              </>
            )}

            <label className="col-span-2 block text-xs">
              <span className="mb-1 block text-muted">Purchase price (USD, optional)</span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="psr-input"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Adding…' : 'Add'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
