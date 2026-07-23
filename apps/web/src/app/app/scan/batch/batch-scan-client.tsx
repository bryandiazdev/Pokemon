'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { compressImageFile } from '@/lib/image-compress';
import { RAW_CONDITIONS } from '@psr/types';
import { Camera, Images, Layers, AlertTriangle, Check, ScanLine } from 'lucide-react';

interface Candidate {
  cardExternalId?: string;
  cardName?: string;
  setHint?: string;
  numberHint?: string;
  language?: string;
  confidence: number;
  ranking: number;
  imageSmallUrl?: string | null;
}

interface BatchCard {
  index: number;
  read: {
    position: string | null;
    name: string | null;
    number: string | null;
    setName: string | null;
    confidence: number;
  };
  candidates: Candidate[];
  requiresConfirmation: boolean;
  note: string | null;
}

interface RowState {
  card: BatchCard;
  /** Which candidate is selected (index into candidates). */
  pick: number;
  included: boolean;
  saved: boolean;
  error: string | null;
}

type Phase = 'capture' | 'analyzing' | 'review' | 'done' | 'failed';

/**
 * Batch scan (Pro): one photo, many cards. Every detected card is matched
 * against the catalog and listed for EXPLICIT confirmation — the user picks
 * the right printing per card (or excludes it) before anything is saved.
 */
export function BatchScanClient() {
  const [phase, setPhase] = useState<Phase>('capture');
  const [rows, setRows] = useState<RowState[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [paywalled, setPaywalled] = useState(false);
  const [condition, setCondition] = useState('near_mint');
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  function fileToDataUrl(file: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    e.target.value = '';
    if (!raw) return;
    if (!raw.type.startsWith('image/')) {
      setMessage('Please choose a photo (JPEG, PNG, or WebP).');
      setPhase('failed');
      return;
    }

    setPhase('analyzing');
    setMessage('');
    setNotice(null);
    try {
      // Multiple cards per frame need more resolution than a single scan —
      // stay high-res, then step down if the encode busts the request budget.
      let file = await compressImageFile(raw, { maxEdge: 2400, quality: 0.85 });
      let imageRef = await fileToDataUrl(file);
      if (imageRef.length > 4_300_000) {
        file = await compressImageFile(raw, { maxEdge: 2000, quality: 0.78 });
        imageRef = await fileToDataUrl(file);
      }
      setPhotoUrl(imageRef);

      const res = await fetch('/api/scan/batch-identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageRef }),
      });
      const body = await res.json();
      if (!body.success) {
        setMessage(body.error?.message ?? 'Batch scan failed.');
        setPaywalled(res.status === 402);
        setPhase('failed');
        return;
      }
      const cards: BatchCard[] = body.data.cards ?? [];
      if (cards.length === 0) {
        setMessage('No cards could be identified in that photo.');
        setPhase('failed');
        return;
      }
      setRows(
        cards.map((card) => ({
          card,
          pick: 0,
          // Confident matches start included; uncertain ones start EXCLUDED so
          // a wrong printing can never slip in silently.
          included: card.candidates.length > 0 && !card.requiresConfirmation,
          saved: false,
          error: null,
        })),
      );
      setRemaining(body.data.remaining ?? null);
      setNotice(body.data.notice ?? null);
      setPhase('review');
    } catch {
      setMessage('Could not analyze that photo. Try another one.');
      setPhase('failed');
    }
  }

  function setRow(index: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  const includedCount = rows.filter((r) => r.included && !r.saved).length;

  async function saveAll() {
    setSaving(true);
    setMessage('');
    let saved = savedCount;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      if (!row.included || row.saved) continue;
      const candidate = row.card.candidates[row.pick];
      if (!candidate?.cardExternalId) {
        setRow(i, { error: 'No catalog card selected.' });
        continue;
      }
      try {
        const res = await fetch('/api/collection/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardExternalId: candidate.cardExternalId,
            quantity: 1,
            ownershipType: 'raw',
            rawCondition: condition,
            purchaseCurrency: 'USD',
          }),
        });
        const body = await res.json();
        if (body.success) {
          saved += 1;
          setRow(i, { saved: true, error: null });
        } else {
          setRow(i, { error: body.error?.message ?? 'Could not add this card.' });
        }
      } catch {
        setRow(i, { error: 'Network error — this card was not added.' });
      }
    }
    setSavedCount(saved);
    setSaving(false);
    setPhase(saved > 0 ? 'done' : 'review');
  }

  if (phase === 'analyzing') {
    return (
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <Layers className="animate-pulse text-accent" size={32} />
        <p className="font-medium">Finding every card…</p>
        <p className="text-sm text-muted">
          Reading names and numbers for each card in the photo.
        </p>
      </Card>
    );
  }

  if (phase === 'failed') {
    return (
      <Card className="space-y-3">
        <div className="flex items-center gap-2 text-warning">
          <AlertTriangle size={18} />
          <span className="font-medium">{paywalled ? 'Upgrade needed' : 'Let’s retake that'}</span>
        </div>
        <p className="text-sm text-muted">{message}</p>
        <div className="flex gap-2">
          {paywalled && (
            <Link
              href="/pricing"
              className="inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-medium text-bg hover:bg-accent-strong"
            >
              See plans
            </Link>
          )}
          <Button onClick={() => setPhase('capture')}>Try again</Button>
        </div>
      </Card>
    );
  }

  if (phase === 'done') {
    const failures = rows.filter((r) => r.included && !r.saved);
    return (
      <Card className="space-y-4 py-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-positive/15 text-positive">
          <Check />
        </div>
        <p className="font-medium">
          {savedCount} card{savedCount === 1 ? '' : 's'} added to your collection
        </p>
        {failures.length > 0 && (
          <p className="text-sm text-warning">
            {failures.length} card{failures.length === 1 ? '' : 's'} could not be added — go back
            to review to retry.
          </p>
        )}
        <div className="flex justify-center gap-2">
          <Link
            href="/app/collection"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-medium text-bg"
          >
            View collection
          </Link>
          {failures.length > 0 && (
            <Button variant="secondary" onClick={() => setPhase('review')}>
              Back to review
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              setRows([]);
              setSavedCount(0);
              setPhase('capture');
            }}
          >
            Scan another batch
          </Button>
        </div>
      </Card>
    );
  }

  if (phase === 'review') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            Confirm each card — uncheck anything that&rsquo;s wrong, or switch to the correct
            printing.
          </p>
          {remaining != null && <Badge tone="info">{remaining} scans left</Badge>}
        </div>

        {notice && <p className="text-xs text-warning">{notice}</p>}
        {message && <p className="text-xs text-warning">{message}</p>}

        <div className="flex items-center gap-3">
          {photoUrl && (
            <figure className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="Your batch photo"
                className="h-24 w-32 rounded object-cover ring-1 ring-border"
              />
              <figcaption className="mt-1 text-center text-[10px] text-muted">
                Your photo
              </figcaption>
            </figure>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted">Condition for all added cards</span>
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
        </div>

        <ul className="space-y-3">
          {rows.map((row, i) => {
            const picked = row.card.candidates[row.pick];
            return (
              <li
                key={row.card.index}
                className={`rounded-lg border p-3 transition-colors ${
                  row.saved
                    ? 'border-positive/40 bg-positive/5'
                    : row.included
                      ? 'border-accent/40 bg-bg-deep/30'
                      : 'border-border bg-bg-deep/20 opacity-80'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={row.included}
                    disabled={row.saved || row.card.candidates.length === 0}
                    onChange={(e) => setRow(i, { included: e.target.checked })}
                    aria-label={`Include ${picked?.cardName ?? row.card.read.name ?? `card ${i + 1}`}`}
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  />
                  {picked?.imageSmallUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={picked.imageSmallUrl}
                      alt={picked.cardName ?? 'Card'}
                      className="h-20 w-[57px] shrink-0 rounded object-cover ring-1 ring-border"
                    />
                  ) : (
                    <span className="flex h-20 w-[57px] shrink-0 items-center justify-center rounded bg-bg text-faint ring-1 ring-border">
                      <ScanLine size={16} aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-faint">
                        {row.card.read.position ?? `Card ${i + 1}`}
                      </span>
                      {row.saved ? (
                        <Badge tone="positive">
                          <Check size={11} aria-hidden /> Added
                        </Badge>
                      ) : row.card.requiresConfirmation && row.card.candidates.length > 0 ? (
                        <Badge tone="warning">Check this one</Badge>
                      ) : null}
                    </div>

                    {row.card.candidates.length > 0 ? (
                      <>
                        <select
                          className="psr-input max-w-full"
                          value={row.pick}
                          disabled={row.saved}
                          onChange={(e) => setRow(i, { pick: Number(e.target.value) })}
                          aria-label="Choose the matching card"
                        >
                          {row.card.candidates.map((c, j) => (
                            <option key={c.ranking} value={j}>
                              {c.cardName}
                              {c.numberHint ? ` · #${c.numberHint}` : ''}
                              {c.setHint ? ` · ${c.setHint}` : ''}
                              {` · ${(c.confidence * 100).toFixed(0)}%`}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted">
                          Read from photo: {row.card.read.name ?? '—'}
                          {row.card.read.number ? ` · #${row.card.read.number}` : ''}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-warning">
                        {row.card.note ?? 'No catalog match for this card.'}
                      </p>
                    )}
                    {row.error && <p className="text-xs text-negative">{row.error}</p>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void saveAll()} disabled={saving || includedCount === 0}>
            {saving
              ? 'Adding…'
              : `Add ${includedCount} card${includedCount === 1 ? '' : 's'} to collection`}
          </Button>
          <Button variant="ghost" onClick={() => setPhase('capture')} disabled={saving}>
            Rescan
          </Button>
        </div>
      </div>
    );
  }

  // capture
  return (
    <div className="space-y-4">
      <Card className="flex flex-col items-center gap-4 py-8">
        <div className="relative flex aspect-[4/3] w-64 items-center justify-center rounded-xl border-2 border-dashed border-accent/50 text-muted">
          <Layers size={28} className="text-accent/60" />
          <span className="absolute bottom-2 text-[11px]">
            Lay cards flat, face up, no overlap
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => cameraRef.current?.click()}>
            <Camera size={16} /> Take photo
          </Button>
          <Button variant="secondary" onClick={() => libraryRef.current?.click()}>
            <Images size={16} /> Choose from library
          </Button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          className="hidden"
        />
        <input ref={libraryRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        <p className="max-w-sm text-center text-[11px] text-muted">
          Up to 12 cards per photo; each identified card uses one scan. Bright, even light and a
          straight-down angle work best. Photos are analyzed in-memory and never stored.
        </p>
      </Card>
      <p className="text-center text-xs text-muted">
        One card at a time?{' '}
        <Link href="/app/scan" className="text-accent hover:underline">
          Use single scan
        </Link>
        .
      </p>
    </div>
  );
}
