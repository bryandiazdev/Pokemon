'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, ScanLine, AlertTriangle, Check } from 'lucide-react';

interface Candidate {
  cardExternalId?: string;
  cardName?: string;
  numberHint?: string;
  language?: string;
  confidence: number;
  ranking: number;
}

type Phase = 'capture' | 'analyzing' | 'confirm' | 'rejected' | 'saved';

/**
 * Real quick-scan. Captures a photo, runs on-device OCR (Tesseract.js — free,
 * private, no upload of the image bytes), extracts the card name + collector
 * number, and matches them against the LIVE catalog (TCGdex via the catalog-OCR
 * recognition adapter). Ranked candidates always require explicit confirmation
 * for look-alikes; confirming saves the card to your real collection.
 */
export function ScanClient() {
  const [phase, setPhase] = useState<Phase>('capture');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState<Candidate | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function runOcr(dataUrl: string): Promise<{ name?: string; number?: string; rawText?: string }> {
    setStatus('Reading the card text on your device…');
    // Load Tesseract lazily so it doesn't bloat the initial bundle.
    const Tesseract = (await import('tesseract.js')).default;
    const { data } = await Tesseract.recognize(dataUrl, 'eng');
    const lines = (data.lines ?? []) as Array<{ text: string; bbox?: { y0: number } }>;
    const heightOf = (l: { bbox?: { y0: number } }) => l.bbox?.y0 ?? 0;
    const imgTop = Math.min(...lines.map(heightOf), 0);
    const imgBottom = Math.max(...lines.map(heightOf), 1);
    const topBand = imgTop + (imgBottom - imgTop) * 0.35;

    // Name: the largest, mostly-alphabetic line in the top third of the card.
    const nameCandidates = lines
      .filter((l) => heightOf(l) <= topBand)
      .map((l) => l.text.trim())
      .filter((t) => t.replace(/[^A-Za-z]/g, '').length >= 3)
      .filter((t) => !/^(hp|basic|stage|trainer|energy|illus|©)/i.test(t));
    nameCandidates.sort(
      (a, b) => b.replace(/[^A-Za-z]/g, '').length - a.replace(/[^A-Za-z]/g, '').length,
    );
    const name = nameCandidates[0]?.replace(/[^A-Za-z'’.\- ]/g, '').trim();

    // Collector number: "4/102", "058/165", etc. (usually near the bottom).
    const numMatch = data.text.match(/\b(\d{1,3})\s*\/\s*\d{1,3}\b/);
    const number = numMatch ? String(parseInt(numMatch[1]!, 10)) : undefined;

    return { name, number, rawText: data.text.slice(0, 2000) };
  }

  async function identify(ocr: { name?: string; number?: string }, quality?: Record<string, number>) {
    setPhase('analyzing');
    setStatus('Matching against the live catalog…');
    const res = await fetch('/api/scan/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageRef: 'camera', ocr, quality }),
    });
    const body = await res.json();
    if (!body.success) {
      setMessage(body.error.message);
      setPhase('rejected');
      return;
    }
    if (!body.data.candidates?.length) {
      setMessage(
        `No catalog match for "${ocr.name ?? ''} ${ocr.number ?? ''}". Try a sharper, well-lit photo or search manually.`,
      );
      setPhase('rejected');
      return;
    }
    setCandidates(body.data.candidates);
    setRemaining(body.data.remaining);
    setPhase('confirm');
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      setPhase('analyzing');
      try {
        const ocr = await runOcr(dataUrl);
        if (!ocr.name && !ocr.number) {
          setMessage('Could not read any text — retake in brighter, even light with the card flat and in focus.');
          setPhase('rejected');
          return;
        }
        await identify(ocr, { blur: 0.2, glare: 0.1, coverage: 0.7, brightness: 0.6 });
      } catch {
        setMessage('OCR failed to run. Try uploading a clearer photo.');
        setPhase('rejected');
      }
    };
    reader.readAsDataURL(file);
  }

  async function save(c: Candidate) {
    if (!c.cardExternalId) return;
    setSaving(true);
    setMessage('');
    const res = await fetch('/api/collection/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardExternalId: c.cardExternalId,
        quantity: 1,
        ownershipType: 'raw',
        rawCondition: 'near_mint',
        purchaseCurrency: 'USD',
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!body.success) {
      setMessage(body.error.message);
      return;
    }
    setConfirmed(c);
    setPhase('saved');
  }

  if (phase === 'analyzing') {
    return (
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <ScanLine className="animate-pulse text-accent" size={32} />
        <p className="font-medium">Identifying card…</p>
        <p className="text-sm text-muted">{status || 'Working…'}</p>
      </Card>
    );
  }

  if (phase === 'rejected') {
    return (
      <Card className="space-y-3">
        <div className="flex items-center gap-2 text-warning">
          <AlertTriangle size={18} />
          <span className="font-medium">Let’s retake that</span>
        </div>
        <p className="text-sm text-muted">{message}</p>
        <div className="flex gap-2">
          <Button onClick={() => setPhase('capture')}>Try again</Button>
          <Link href="/app/collection/add" className="self-center text-sm text-accent hover:underline">
            Search manually
          </Link>
        </div>
      </Card>
    );
  }

  if (phase === 'saved' && confirmed) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-positive/15 text-positive">
          <Check />
        </div>
        <p className="font-medium">{confirmed.cardName} added to your collection</p>
        <div className="flex gap-2">
          <Link
            href="/app/collection"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-medium text-bg"
          >
            View collection
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              setConfirmed(null);
              setCandidates([]);
              setPhase('capture');
            }}
          >
            Scan next card
          </Button>
        </div>
      </Card>
    );
  }

  if (phase === 'confirm') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Confirm the exact printing — these look similar but differ by set, finish, or language.
          </p>
          {remaining != null && <Badge tone="info">{remaining} scans left</Badge>}
        </div>
        {message && <p className="text-xs text-warning">{message}</p>}
        <ul className="space-y-2">
          {candidates.map((c) => (
            <li key={c.ranking}>
              <button
                type="button"
                disabled={saving}
                onClick={() => save(c)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-surface p-3 text-left hover:border-accent disabled:opacity-50"
              >
                <div>
                  <div className="font-medium">{c.cardName}</div>
                  <div className="text-xs text-muted">
                    #{c.numberHint} · {c.language?.toUpperCase()} · {c.cardExternalId}
                  </div>
                </div>
                <Badge tone={c.confidence > 0.6 ? 'positive' : 'neutral'}>
                  {(c.confidence * 100).toFixed(0)}% match
                </Badge>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPhase('capture')} className="text-sm text-accent hover:underline">
            Rescan
          </button>
          <span className="text-muted">·</span>
          <Link href="/app/collection/add" className="text-sm text-accent hover:underline">
            None of these — search manually
          </Link>
        </div>
      </div>
    );
  }

  // capture
  return (
    <div className="space-y-4">
      <Card className="flex flex-col items-center gap-4 py-8">
        <div className="relative flex aspect-[2.5/3.5] w-48 items-center justify-center rounded-xl border-2 border-dashed border-accent/50 text-muted">
          <Camera size={28} className="text-accent/60" />
          <span className="absolute bottom-2 text-[11px]">Align card in frame</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Scan / upload photo
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              identify({ name: 'Charizard', number: '4' }, { blur: 0.2, glare: 0.1, coverage: 0.7, brightness: 0.6 })
            }
          >
            Try a sample (Charizard)
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
        <p className="text-center text-[11px] text-muted">
          Text is read on your device with OCR — the photo isn’t uploaded.
        </p>
      </Card>
      <p className="text-center text-xs text-muted">
        Quick scan identifies the card. For a grade estimate, use the{' '}
        <Link href="/app/grade" className="text-accent hover:underline">
          guided Grade Potential flow
        </Link>
        .
      </p>
    </div>
  );
}
