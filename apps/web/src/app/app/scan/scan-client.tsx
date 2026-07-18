'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { compressImageFile } from '@/lib/image-compress';
import { runCardOcr, computeQuality, cropNumberStrip } from '@/lib/scan-ocr';
import { Camera, Images, ScanLine, AlertTriangle, Check } from 'lucide-react';

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

type Phase = 'capture' | 'analyzing' | 'confirm' | 'rejected' | 'saved';

/**
 * Real quick-scan. Take a photo or pick one from your library; the card is
 * identified from the photo (on-device OCR first, upgraded by server-side
 * vision when configured) and matched against the live catalog. Ranked
 * candidates always require explicit confirmation for look-alikes; confirming
 * saves the card to your real collection. Photos are analyzed in-memory and
 * never stored.
 */
export function ScanClient() {
  const [phase, setPhase] = useState<Phase>('capture');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [readText, setReadText] = useState<{ name: string | null; number: string | null } | null>(
    null,
  );
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [visionOff, setVisionOff] = useState(false);
  const [visionNote, setVisionNote] = useState<string | null>(null);
  const [serverFault, setServerFault] = useState(false);
  const [confirmed, setConfirmed] = useState<Candidate | null>(null);
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  async function identify(body: {
    imageRef: string;
    numberCrop?: string;
    ocr?: { name?: string; number?: string; rawText?: string };
    quality?: { blur?: number; brightness?: number };
  }) {
    setStatus('Matching against the catalog…');
    const res = await fetch('/api/scan/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const resBody = await res.json();
    if (!resBody.success) {
      setMessage(resBody.error.message);
      setServerFault(resBody.error.code === 'internal_error');
      setPhase('rejected');
      return;
    }
    if (!resBody.data.candidates?.length) {
      const read = resBody.data.readText;
      const note = resBody.data.visionNote ? ` ${resBody.data.visionNote}` : '';
      setMessage(
        `No catalog match${read?.name ? ` for "${read.name}${read.number ? ` #${read.number}` : ''}"` : ''}. Try a sharper, well-lit photo or search manually.${note}`,
      );
      setServerFault(Boolean(resBody.data.visionNote));
      setPhase('rejected');
      return;
    }
    setCandidates(resBody.data.candidates);
    setRemaining(resBody.data.remaining);
    setReadText(resBody.data.readText ?? null);
    setVisionOff(resBody.data.visionAvailable === false);
    setVisionNote(resBody.data.visionNote ?? null);
    setPhase('confirm');
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = '';
    if (!raw) return;
    if (!raw.type.startsWith('image/')) {
      setMessage('Please choose a photo (JPEG, PNG, or WebP).');
      setPhase('rejected');
      return;
    }

    setPhase('analyzing');
    setStatus('Preparing the photo…');
    try {
      // High fidelity for the vision pass; fall back to a smaller encode if
      // a busy holo texture blows past the request size budget.
      let file = await compressImageFile(raw, { maxEdge: 2000, quality: 0.88 });
      let imageRef = await fileToDataUrl(file);
      if (imageRef.length > 3_800_000) {
        file = await compressImageFile(raw, { maxEdge: 1600, quality: 0.8 });
        imageRef = await fileToDataUrl(file);
      }
      const [quality, ocr, numberCrop] = await Promise.all([
        computeQuality(file),
        (async () => {
          setStatus('Reading the card…');
          return runCardOcr(file);
        })(),
        // Native-resolution bottom strip from the ORIGINAL photo — the tiny
        // collector number survives there when the full frame is downscaled.
        cropNumberStrip(raw),
      ]);
      setPhotoUrl(imageRef);
      await identify({
        imageRef,
        numberCrop: numberCrop && numberCrop.length <= 1_900_000 ? numberCrop : undefined,
        ocr: ocr.name || ocr.number ? ocr : undefined,
        quality,
      });
    } catch {
      setMessage('Could not analyze that photo. Try another one.');
      setServerFault(false);
      setPhase('rejected');
    }
  }

  function fileToDataUrl(file: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
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
          <span className="font-medium">
            {serverFault ? 'Scanning is temporarily unavailable' : 'Let’s retake that'}
          </span>
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
        <div className="flex items-start gap-3">
          {photoUrl && (
            <figure className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="Your scanned card"
                className="h-28 w-20 rounded object-cover ring-1 ring-border"
              />
              <figcaption className="mt-1 text-center text-[10px] text-muted">Your photo</figcaption>
            </figure>
          )}
          <div className="space-y-1.5">
            {readText && (readText.name || readText.number) && (
              <p className="text-xs text-muted">
                Read from the card: <span className="text-content">{readText.name ?? '—'}</span>
                {readText.number && <span className="text-content"> · #{readText.number}</span>}
              </p>
            )}
            {visionOff && (
              <p className="text-xs text-warning">
                Identified with on-device OCR only — server vision is off. Set OPENAI_API_KEY on the
                server for far more reliable scans.
              </p>
            )}
            {visionNote && <p className="text-xs text-warning">{visionNote}</p>}
          </div>
        </div>
        {message && <p className="text-xs text-warning">{message}</p>}
        <ul className="space-y-2">
          {candidates.map((c) => (
            <li key={c.ranking}>
              <button
                type="button"
                disabled={saving}
                onClick={() => save(c)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left hover:border-accent disabled:opacity-50"
              >
                {c.imageSmallUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.imageSmallUrl}
                    alt={c.cardName ?? 'Card'}
                    className="h-20 w-[57px] shrink-0 rounded object-cover ring-1 ring-border"
                  />
                ) : (
                  <span className="flex h-20 w-[57px] shrink-0 items-center justify-center rounded bg-bg text-faint ring-1 ring-border">
                    <ScanLine size={16} aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1">
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
          <Button onClick={() => cameraRef.current?.click()}>
            <Camera size={16} /> Take photo
          </Button>
          <Button variant="secondary" onClick={() => libraryRef.current?.click()}>
            <Images size={16} /> Choose from library
          </Button>
          <Button
            variant="ghost"
            onClick={() => identify({ imageRef: 'camera', ocr: { name: 'Charizard', number: '4' } })}
          >
            Try a sample (Charizard)
          </Button>
        </div>
        {/* `capture` steers straight to the camera; the library input omits it
            so the OS offers the photo picker. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          className="hidden"
        />
        <input ref={libraryRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        <p className="text-center text-[11px] text-muted">
          Your photo is analyzed to identify the card, then discarded — never stored.
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
