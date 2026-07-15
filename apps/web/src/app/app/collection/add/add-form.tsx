'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { NormalizedCard } from '@psr/providers';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Search } from 'lucide-react';
import { RAW_CONDITIONS, GRADING_COMPANIES } from '@psr/types';

const schema = z.object({
  quantity: z.coerce.number().int().min(1).max(1000),
  ownershipType: z.enum(['raw', 'graded']),
  rawCondition: z.enum(RAW_CONDITIONS).optional(),
  gradingCompany: z.enum(GRADING_COMPANIES).optional(),
  grade: z.string().optional(),
  purchasePriceMajor: z.coerce.number().min(0).optional(),
  purchaseDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
});
type FormValues = z.infer<typeof schema>;

export function AddForm() {
  const [selected, setSelected] = useState<NormalizedCard | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NormalizedCard[]>([]);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1, ownershipType: 'raw', rawCondition: 'near_mint' },
  });
  const ownership = watch('ownershipType');

  async function runSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) return setResults([]);
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const body = await res.json();
    if (body.success) setResults(body.data.cards);
  }

  async function onSubmit(values: FormValues) {
    if (!selected) return;
    const res = await fetch('/api/collection/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardExternalId: selected.externalId,
        ...values,
        purchaseCurrency: 'USD',
      }),
    });
    const body = await res.json();
    if (body.success) setDone(true);
  }

  if (done) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-positive/15 text-positive">
          <Check />
        </div>
        <p className="font-medium">Added {selected?.name} to your collection.</p>
        <p className="text-sm text-muted">In demo mode this isn’t persisted.</p>
        <Button variant="secondary" onClick={() => { setDone(false); setSelected(null); }}>
          Add another
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!selected ? (
        <Card>
          <label htmlFor="add-search" className="text-sm font-medium">
            Find the card
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3">
            <Search size={16} className="text-muted" />
            <input
              id="add-search"
              value={query}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="Charizard 4, Mew ex, Pikachu 58…"
              className="h-11 w-full bg-transparent text-sm outline-none"
              autoComplete="off"
            />
          </div>
          <ul className="mt-2 divide-y divide-border">
            {results.map((c) => (
              <li key={c.externalId}>
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  className="flex w-full items-center justify-between px-1 py-2 text-left text-sm hover:text-accent"
                >
                  <span>{c.name}</span>
                  <span className="text-xs text-muted">#{c.number}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Card className="flex items-center justify-between">
            <div>
              <div className="font-medium">{selected.name}</div>
              <div className="text-xs text-muted">#{selected.number}</div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Change
            </Button>
          </Card>

          <Card className="grid gap-4 sm:grid-cols-2">
            <Field label="Ownership">
              <select {...register('ownershipType')} className="psr-input">
                <option value="raw">Raw</option>
                <option value="graded">Graded</option>
              </select>
            </Field>
            <Field label="Quantity">
              <input type="number" min={1} {...register('quantity')} className="psr-input" />
            </Field>

            {ownership === 'raw' ? (
              <Field label="Condition">
                <select {...register('rawCondition')} className="psr-input">
                  {RAW_CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <>
                <Field label="Grading company">
                  <select {...register('gradingCompany')} className="psr-input">
                    {GRADING_COMPANIES.map((c) => (
                      <option key={c} value={c}>
                        {c.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Grade" error={errors.grade?.message}>
                  <input {...register('grade')} placeholder="10" className="psr-input" />
                </Field>
              </>
            )}

            <Field label="Purchase price (USD)">
              <input type="number" step="0.01" {...register('purchasePriceMajor')} className="psr-input" />
            </Field>
            <Field label="Purchase date">
              <input type="date" {...register('purchaseDate')} className="psr-input" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <textarea {...register('notes')} rows={2} className="psr-input" />
              </Field>
            </div>
          </Card>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Adding…' : 'Add to collection'}
          </Button>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-negative">{error}</span>}
    </label>
  );
}
