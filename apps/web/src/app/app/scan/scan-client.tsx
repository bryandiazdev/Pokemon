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

type Phase = 'capture' | 'analyzing' | 'confirm' | 'rejected';

/**
 * Quick-scan client. In a real device flow this drives getUserMedia with a
 * card-framing guide and computes quality metrics on-device before upload. Here
 * upload / "use sample" both post to the recognition endpoint, which returns
 * RANKED candidates that always require explicit confirmation for look-alikes.
 */
export function ScanClient() {
  const [phase, setPhase] = useState<Phase>('capture');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [message, setMessage] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState<Candidate | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function identify(imageRef: string, quality?: Record<string, number>) {
    setPhase('analyzing');
    const res = await fetch('/api/scan/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageRef, quality }),
    });
    const body = await res.json();
    if (!body.success) {
      setMessage(body.error.message);
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
    reader.onload = () => {
      // A production flow computes real blur/glare/coverage here (see vision service).
      identify(String(reader.result).slice(0, 500), { blur: 0.2, glare: 0.1, coverage: 0.7, brightness: 0.6 });
    };
    reader.readAsDataURL(file);
  }

  if (phase === 'analyzing') {
    return (
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <ScanLine className="animate-pulse text-accent" size={32} />
        <p className="font-medium">Identifying card…</p>
        <p className="text-sm text-muted">Checking image quality and matching against the catalog.</p>
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
        <Button onClick={() => setPhase('capture')}>Try again</Button>
      </Card>
    );
  }

  if (phase === 'confirm' && confirmed) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-positive/15 text-positive">
          <Check />
        </div>
        <p className="font-medium">{confirmed.cardName} confirmed</p>
        <div className="flex gap-2">
          <Link
            href={`/app/collection/add`}
            className="inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-medium text-bg"
          >
            Add to collection
          </Link>
          <Button variant="secondary" onClick={() => { setConfirmed(null); setPhase('capture'); }}>
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
        <ul className="space-y-2">
          {candidates.map((c) => (
            <li key={c.ranking}>
              <button
                type="button"
                onClick={() => setConfirmed(c)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-surface p-3 text-left hover:border-accent"
              >
                <div>
                  <div className="font-medium">{c.cardName}</div>
                  <div className="text-xs text-muted">
                    #{c.numberHint} · {c.language?.toUpperCase()}
                  </div>
                </div>
                <Badge tone={c.confidence > 0.6 ? 'positive' : 'neutral'}>
                  {(c.confidence * 100).toFixed(0)}% match
                </Badge>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
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
            <Upload size={16} /> Upload image
          </Button>
          <Button
            variant="secondary"
            onClick={() => identify('demo-sample', { blur: 0.2, glare: 0.1, coverage: 0.7, brightness: 0.6 })}
          >
            Use sample image
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
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
