'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GradeDisclaimer } from '@/components/disclaimer';
import { CheckCircle2, Circle, Camera } from 'lucide-react';

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
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>• Remove the card from sleeves and top loaders.</li>
          <li>• Use a clean, dark, non-reflective background and bright indirect light.</li>
          <li>• Clean the camera lens; keep the card flat and the camera parallel.</li>
          <li>• Avoid fingers over corners and edges; don’t apply filters.</li>
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
                  className="flex w-full items-center gap-2 rounded-lg border border-border p-3 text-left text-sm hover:border-accent"
                >
                  {done ? (
                    <CheckCircle2 size={18} className="text-positive" />
                  ) : (
                    <Circle size={18} className="text-muted" />
                  )}
                  <span className="flex-1">{c.label}</span>
                  {c.required && !done && <Badge tone="warning">Required</Badge>}
                  <Camera size={15} className="text-muted" />
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

      <Button onClick={runAnalysis} disabled={!requiredDone || loading}>
        {loading ? 'Analyzing…' : 'Run Grade Potential analysis'}
      </Button>
      {!requiredDone && (
        <p className="text-xs text-muted">Complete the required captures to run the analysis.</p>
      )}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const tone = value >= 85 ? 'bg-positive' : value >= 65 ? 'bg-warning' : 'bg-negative';
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
        <div className={`h-full ${tone}`} style={{ width: `${value}%` }} aria-hidden />
      </div>
    </div>
  );
}

function GradeReport({ report, onReset }: { report: Report; onReset: () => void }) {
  const { estimate, scores } = report;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Grade Potential report</h2>
        <Button variant="ghost" size="sm" onClick={onReset}>
          New analysis
        </Button>
      </div>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-muted">Estimated PSA range</div>
            <div className="text-3xl font-semibold tabular-nums">
              {estimate.estimatedMinGrade}–{estimate.estimatedMaxGrade}
            </div>
            <div className="text-sm text-muted">
              Estimated ceiling: PSA {estimate.estimatedCeiling}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase text-muted">Confidence</div>
            <div className="text-2xl font-semibold tabular-nums">
              {(estimate.overallConfidence * 100).toFixed(0)}%
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Badge tone={estimate.submissionRecommendation.includes('Strong') ? 'positive' : 'neutral'}>
            {estimate.submissionRecommendation}
          </Badge>
        </div>
      </Card>

      <Card>
        <CardTitle>Condition sub-scores</CardTitle>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ScoreBar label="Centering" value={scores.centering} />
          <ScoreBar label="Corners" value={scores.corner} />
          <ScoreBar label="Edges" value={scores.edge} />
          <ScoreBar label="Surface" value={scores.surface} />
          <ScoreBar label="Structural" value={scores.structural} />
          <ScoreBar label="Image quality" value={scores.imageQuality} />
        </div>
      </Card>

      {(estimate.limitingDefects.length > 0 || estimate.suggestedRecaptures.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {estimate.limitingDefects.length > 0 && (
            <Card>
              <CardTitle>Factors limiting the grade</CardTitle>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {estimate.limitingDefects.map((d, i) => (
                  <li key={i}>• {d}</li>
                ))}
              </ul>
            </Card>
          )}
          {estimate.suggestedRecaptures.length > 0 && (
            <Card>
              <CardTitle>Recommended recaptures</CardTitle>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {estimate.suggestedRecaptures.map((d, i) => (
                  <li key={i}>• {d}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <div className="text-xs text-muted">
        Model {report.modelVersion}. Analyzed just now from demo captures.
      </div>
      <GradeDisclaimer />
    </div>
  );
}
