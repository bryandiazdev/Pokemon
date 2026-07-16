'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GradeDisclaimer } from '@/components/disclaimer';
import { RadarMark } from '@/components/brand';
import { CheckCircle2, Circle, Camera, RotateCcw } from 'lucide-react';

const CAPTURES = [
  { key: 'front', label: 'Front — straight on', required: true },
  { key: 'back', label: 'Back — straight on', required: true },
  { key: 'front_angled', label: 'Front — angled light', required: true },
  { key: 'corner_tl', label: 'Top-left corner', required: false },
  { key: 'corner_tr', label: 'Top-right corner', required: false },
  { key: 'corner_bl', label: 'Bottom-left corner', required: false },
  { key: 'corner_br', label: 'Bottom-right corner', required: false },
];

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
}

export function GradeClient() {
  const [captured, setCaptured] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const requiredDone = CAPTURES.filter((c) => c.required).every((c) => captured.has(c.key));

  function toggle(key: string) {
    setCaptured((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function runAnalysis() {
    setLoading(true);
    const res = await fetch('/api/grade/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardExternalId: 'base1-4' }),
    });
    const body = await res.json();
    setLoading(false);
    if (body.success) setReport(body.data);
  }

  if (report) return <GradeReport report={report} onReset={() => setReport(null)} />;

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle>Before you start</CardTitle>
        <ul className="mt-3 space-y-1.5 text-sm text-muted">
          <li>· Remove the card from sleeves and top loaders.</li>
          <li>· Use a clean, dark, non-reflective background and bright indirect light.</li>
          <li>· Clean the camera lens; keep the card flat and the camera parallel.</li>
          <li>· Avoid fingers over corners and edges; don’t apply filters.</li>
        </ul>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Guided captures</CardTitle>
          <Badge tone={requiredDone ? 'positive' : 'neutral'}>
            {captured.size}/{CAPTURES.length}
          </Badge>
        </CardHeader>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CAPTURES.map((c) => {
            const done = captured.has(c.key);
            return (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => toggle(c.key)}
                  className={`flex w-full items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                    done
                      ? 'border-accent/40 bg-accent/5'
                      : 'border-border hover:border-border-strong'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 size={18} className="text-positive" />
                  ) : (
                    <Circle size={18} className="text-faint" />
                  )}
                  <span className="flex-1">{c.label}</span>
                  {c.required && !done && <Badge tone="warning">REQ</Badge>}
                  <Camera size={15} className="text-faint" />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Tap a capture to simulate taking it (demo). On a device, each opens the camera with an
          on-screen quality check that rejects blur, glare, and poor coverage.
        </p>
      </Card>

      <Button variant="holo" onClick={runAnalysis} disabled={!requiredDone || loading}>
        {loading ? 'Analyzing…' : 'Run Grade Potential analysis'}
      </Button>
      {!requiredDone && (
        <p className="text-xs text-muted">Complete the required captures to run the analysis.</p>
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

function GradeReport({ report, onReset }: { report: Report; onReset: () => void }) {
  const { estimate, scores } = report;
  const strong = estimate.submissionRecommendation.includes('Strong');
  const possible = estimate.submissionRecommendation.includes('Possible');
  const recTone = strong ? 'positive' : possible ? 'gold' : 'neutral';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Grade Potential report</h2>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw size={14} /> New analysis
        </Button>
      </div>

      {/* Headline result — styled as a grading "slab label". */}
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
            <div className="mt-2 label-strip">
              Ceiling · PSA {estimate.estimatedCeiling}
            </div>
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

      <div className="label-strip">Model {report.modelVersion} · analyzed just now from demo captures</div>
      <GradeDisclaimer />
    </div>
  );
}
