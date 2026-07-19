'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GradeDisclaimer } from '@/components/disclaimer';
import { RadarMark } from '@/components/brand';
import { compressImageFile, fitFilesToBudget } from '@/lib/image-compress';
import { computeQuality } from '@/lib/scan-ocr';
import { CheckCircle2, Circle, Camera, Upload, RotateCcw, X, ImageIcon, AlertTriangle } from 'lucide-react';

const CAPTURES = [
  {
    key: 'front',
    label: 'Front — straight on',
    hint: 'Card flat, camera parallel, full card in frame',
    required: true,
  },
  {
    key: 'back',
    label: 'Back — straight on',
    hint: 'Same framing as the front',
    required: true,
  },
  {
    key: 'front_angled',
    label: 'Front — angled light',
    hint: 'Tilt light to reveal surface scratches',
    required: true,
  },
  {
    key: 'corner_tl',
    label: 'Top-left corner',
    hint: 'Optional close-up',
    required: false,
  },
  {
    key: 'corner_tr',
    label: 'Top-right corner',
    hint: 'Optional close-up',
    required: false,
  },
  {
    key: 'corner_bl',
    label: 'Bottom-left corner',
    hint: 'Optional close-up',
    required: false,
  },
  {
    key: 'corner_br',
    label: 'Bottom-right corner',
    hint: 'Optional close-up',
    required: false,
  },
] as const;

type CaptureKey = (typeof CAPTURES)[number]['key'];

interface CaptureSlot {
  file: File;
  previewUrl: string;
  /** Client-side sharpness check flagged this capture as soft/blurry. */
  soft?: boolean;
}

interface Estimate {
  estimatedMinGrade: number;
  estimatedMaxGrade: number;
  estimatedCeiling: number;
  overallConfidence: number;
  submissionRecommendation: string;
  limitingDefects: string[];
  suggestedRecaptures: string[];
}
interface Scores {
  centering: number;
  corner: number;
  edge: number;
  surface: number;
  structural: number;
  imageQuality: number;
}
interface Report {
  estimate: Estimate;
  scores: Scores;
  disclaimer: string;
  modelVersion: string;
  remaining: number | null;
  captures?: string[];
  analysisSummary?: string;
  cardIdentification?: string | null;
}

export function GradeClient() {
  const [slots, setSlots] = useState<Partial<Record<CaptureKey, CaptureSlot>>>({});
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paywalled, setPaywalled] = useState(false);
  const [activeKey, setActiveKey] = useState<CaptureKey | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const requiredDone = CAPTURES.filter((c) => c.required).every((c) => slots[c.key]);
  const uploadedCount = Object.keys(slots).length;
  const softRequired = CAPTURES.filter((c) => c.required && slots[c.key]?.soft).map(
    (c) => c.label,
  );

  function openPicker(key: CaptureKey) {
    setActiveKey(key);
    // Reset so choosing the same file again still fires onChange.
    if (fileRef.current) fileRef.current.value = '';
    fileRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const key = activeKey;
    const raw = e.target.files?.[0];
    setActiveKey(null);
    if (!key || !raw) return;
    if (!raw.type.startsWith('image/')) {
      setError('Please choose a photo (JPEG, PNG, or WebP).');
      return;
    }

    setError('');
    try {
      // Grading needs fine surface detail — 2576px is exactly Claude's
      // high-res vision long edge, so nothing is wasted or lost.
      const file = await compressImageFile(raw, { maxEdge: 2576, quality: 0.92 });
      // Warn on soft focus BEFORE analysis so blurry photos get retaken
      // instead of producing a low-confidence grade.
      let soft = false;
      try {
        const q = await computeQuality(file);
        soft = q.blur > 0.55;
      } catch {
        // sharpness check is best-effort
      }
      const previewUrl = URL.createObjectURL(file);
      setSlots((prev) => {
        const existing = prev[key];
        if (existing) URL.revokeObjectURL(existing.previewUrl);
        return { ...prev, [key]: { file, previewUrl, soft } };
      });
    } catch {
      setError('Could not read that photo. Try another image.');
    }
  }

  function clearSlot(key: CaptureKey) {
    setSlots((prev) => {
      const existing = prev[key];
      if (existing) URL.revokeObjectURL(existing.previewUrl);
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function resetAll() {
    setSlots((prev) => {
      for (const slot of Object.values(prev)) {
        if (slot) URL.revokeObjectURL(slot.previewUrl);
      }
      return {};
    });
    setReport(null);
    setError('');
  }

  async function runAnalysis() {
    if (!requiredDone) return;
    setLoading(true);
    setError('');

    // High-fidelity captures can outgrow serverless body limits — step the
    // largest files down until the combined payload fits.
    const present = CAPTURES.filter((c) => slots[c.key]);
    const budgeted = await fitFilesToBudget(
      present.map((c) => slots[c.key]!.file),
      3_900_000,
    );
    const form = new FormData();
    present.forEach((cap, i) => {
      form.append('files', budgeted[i]!, `${cap.key}.jpg`);
      form.append('capture_types', cap.key);
    });
    form.append('cardExternalId', 'base1-4');

    try {
      const res = await fetch('/api/grade/analyze', {
        method: 'POST',
        body: form,
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? 'Analysis failed. Please try again.');
        setPaywalled(
          ['usage_limit_reached', 'entitlement_exceeded', 'subscription_required'].includes(
            body.error?.code,
          ),
        );
        return;
      }
      setReport(body.data);
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (report) {
    return (
      <GradeReport
        report={report}
        onReset={() => {
          setReport(null);
        }}
        onNew={() => resetAll()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle>Before you start</CardTitle>
        <ul className="mt-3 space-y-1.5 text-sm text-muted">
          <li>· Remove the card from sleeves and top loaders.</li>
          <li>· Use a clean, dark, non-reflective background and bright indirect light.</li>
          <li>· Keep the card flat and the camera parallel (except the angled shot).</li>
          <li>· In the camera, tap the card on screen to focus, then hold steady a beat.</li>
          <li>· Upload from your camera roll or take a new photo — avoid filters or zoom.</li>
        </ul>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Guided captures</CardTitle>
          <Badge tone={requiredDone ? 'positive' : 'neutral'}>
            {uploadedCount}/{CAPTURES.length}
          </Badge>
        </CardHeader>

        {/* No `capture` attribute: mobile browsers then offer both the camera
            AND the photo library, instead of forcing a live capture. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={onFileChange}
          aria-hidden
          tabIndex={-1}
        />

        <ul className="grid gap-2 sm:grid-cols-2">
          {CAPTURES.map((c) => {
            const slot = slots[c.key];
            const done = Boolean(slot);
            return (
              <li key={c.key}>
                <div
                  className={`overflow-hidden rounded-lg border transition-colors ${
                    done
                      ? 'border-accent/40 bg-accent/5'
                      : 'border-border hover:border-border-strong'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openPicker(c.key)}
                    className="flex w-full items-start gap-3 p-3 text-left"
                  >
                    <span className="mt-0.5 shrink-0">
                      {done ? (
                        <CheckCircle2 size={18} className="text-positive" />
                      ) : (
                        <Circle size={18} className="text-faint" />
                      )}
                    </span>

                    {slot ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={slot.previewUrl}
                        alt={`${c.label} preview`}
                        className="h-14 w-11 shrink-0 rounded object-cover ring-1 ring-border"
                      />
                    ) : (
                      <span className="flex h-14 w-11 shrink-0 items-center justify-center rounded bg-bg text-faint ring-1 ring-border">
                        <ImageIcon size={16} aria-hidden />
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium text-content">{c.label}</span>
                        {c.required && !done && <Badge tone="warning">REQ</Badge>}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{c.hint}</span>
                      {slot?.soft && (
                        <span className="mt-1 flex items-center gap-1 text-xs text-warning">
                          <AlertTriangle size={12} aria-hidden />
                          Looks soft — tap to focus on the card, hold steady, and retake.
                        </span>
                      )}
                      <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-accent">
                        {done ? (
                          <>
                            <Camera size={12} aria-hidden />
                            Replace photo
                          </>
                        ) : (
                          <>
                            <Upload size={12} aria-hidden />
                            Take or upload photo
                          </>
                        )}
                      </span>
                    </span>
                  </button>

                  {done && (
                    <div className="flex justify-end border-t border-border/60 px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => clearSlot(c.key)}
                        className="inline-flex items-center gap-1 text-xs text-muted hover:text-negative"
                      >
                        <X size={12} aria-hidden />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-xs text-muted">
          Required shots: front, back, and angled light. Corner close-ups are optional but improve
          corner scoring when a live vision service is connected.
        </p>
      </Card>

      {error && (
        <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          <p>{error}</p>
          {paywalled && (
            <Link
              href="/pricing"
              className="inline-flex min-h-[40px] items-center rounded-lg bg-accent px-4 text-sm font-medium text-bg hover:bg-accent-strong"
            >
              Estimate PSA-grade potential and grading ROI with Pro
            </Link>
          )}
        </div>
      )}

      {requiredDone && softRequired.length > 0 && !loading && (
        <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">
          <p className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              {softRequired.join(' and ')} look{softRequired.length === 1 ? 's' : ''} out of
              focus. Soft photos hide the surface detail that separates an 8 from a 10 — the
              analysis would understate your card. Tap the flagged photo{softRequired.length === 1 ? '' : 's'}{' '}
              to retake: hold 6–8 in / 15–20 cm away, tap the card on your camera screen to lock
              focus, and keep still for a beat after the shutter.
            </span>
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="holo"
          onClick={runAnalysis}
          disabled={!requiredDone || loading || softRequired.length > 0}
        >
          {loading ? 'Analyzing photos…' : 'Run Grade Potential analysis'}
        </Button>
        {requiredDone && softRequired.length > 0 && !loading && (
          <button
            type="button"
            onClick={runAnalysis}
            className="text-xs text-muted underline-offset-2 hover:text-content hover:underline"
          >
            My photos are sharp — analyze anyway
          </button>
        )}
      </div>
      {!requiredDone && (
        <p className="text-xs text-muted">Upload the three required photos to run the analysis.</p>
      )}
    </div>
  );
}

const SCORE_META: Record<keyof Scores, { label: string; color: string }> = {
  centering: { label: 'Centering', color: 'var(--era-water)' },
  corner: { label: 'Corners', color: 'var(--era-psychic)' },
  edge: { label: 'Edges', color: 'var(--era-grass)' },
  surface: { label: 'Surface', color: 'var(--era-lightning)' },
  structural: { label: 'Structural', color: 'var(--era-steel)' },
  imageQuality: { label: 'Image quality', color: 'var(--era-fire)' },
};

function ScoreBar({ metaKey, value }: { metaKey: keyof Scores; value: number }) {
  const meta = SCORE_META[metaKey];
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="label-strip !tracking-wide text-muted">{meta.label}</span>
        <span className="font-mono text-sm tabular text-content">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-bg-deep">
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, background: `rgb(${meta.color})` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

function GradeReport({
  report,
  onReset,
  onNew,
}: {
  report: Report;
  onReset: () => void;
  onNew: () => void;
}) {
  const { estimate, scores } = report;
  const strong = estimate.submissionRecommendation.includes('Strong');
  const possible = estimate.submissionRecommendation.includes('Possible');
  const recTone = strong ? 'positive' : possible ? 'gold' : 'neutral';
  const live = !report.modelVersion.includes('demo');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">Grade Potential report</h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onReset}>
            Back to photos
          </Button>
          <Button variant="ghost" size="sm" onClick={onNew}>
            <RotateCcw size={14} /> New analysis
          </Button>
        </div>
      </div>

      <div className="slab hairline-top holo group overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-bg-deep/60 px-5 py-3">
          <span className="label-strip text-accent">Estimated PSA range · not a guarantee</span>
          <RadarMark size={20} sweep={false} className="opacity-70" />
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-6 p-5">
          <span className="holo-sheen" />
          <div>
            <div className="font-display text-5xl font-semibold leading-none tabular text-content">
              <span className="text-prism">
                {estimate.estimatedMinGrade}–{estimate.estimatedMaxGrade}
              </span>
            </div>
            <div className="mt-2 label-strip">Ceiling · PSA {estimate.estimatedCeiling}</div>
          </div>
          <div className="text-right">
            <div className="label-strip">Confidence</div>
            <div className="font-display text-3xl font-semibold tabular text-content">
              {(estimate.overallConfidence * 100).toFixed(0)}%
            </div>
          </div>
          <div className="w-full">
            <Badge tone={recTone}>{estimate.submissionRecommendation}</Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardTitle>Condition sub-scores</CardTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(Object.keys(SCORE_META) as (keyof Scores)[]).map((k) => (
            <ScoreBar key={k} metaKey={k} value={scores[k]} />
          ))}
        </div>
      </Card>

      {(report.cardIdentification || report.analysisSummary) && (
        <Card>
          <CardTitle>Vision analysis</CardTitle>
          {report.cardIdentification && (
            <p className="mt-3 text-sm text-content">
              Best-match identification: {report.cardIdentification}
            </p>
          )}
          {report.analysisSummary && (
            <p className="mt-2 text-sm leading-relaxed text-muted">{report.analysisSummary}</p>
          )}
        </Card>
      )}

      {(estimate.limitingDefects.length > 0 || estimate.suggestedRecaptures.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {estimate.limitingDefects.length > 0 && (
            <Card>
              <CardTitle>Factors limiting the grade</CardTitle>
              <ul className="mt-3 space-y-1.5 text-sm text-muted">
                {estimate.limitingDefects.map((d, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-negative">▸</span>
                    {d}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {estimate.suggestedRecaptures.length > 0 && (
            <Card>
              <CardTitle>Recommended recaptures</CardTitle>
              <ul className="mt-3 space-y-1.5 text-sm text-muted">
                {estimate.suggestedRecaptures.map((d, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent">▸</span>
                    {d}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <div className="label-strip">
        Model {report.modelVersion} · analyzed from{' '}
        {(report.captures?.length ?? 0) > 0
          ? `${report.captures!.length} uploaded capture${report.captures!.length === 1 ? '' : 's'}`
          : 'uploads'}
        {live ? '' : ' · demo scoring (set ANTHROPIC_API_KEY for live vision)'}
      </div>
      <GradeDisclaimer />
    </div>
  );
}
