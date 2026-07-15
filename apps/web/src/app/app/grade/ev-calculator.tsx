'use client';
import { useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fmtMinor } from '@/lib/format';

interface EvResult {
  currency: string;
  totalCosts: { minor: number };
  expectedGradedValueNet: { minor: number };
  expectedRawNet: { minor: number };
  expectedGainOverRaw: { minor: number };
  breakEvenGrade: number | null;
  downside: { grade: number; net: { minor: number } };
  upside: { grade: number; net: { minor: number } };
  confidenceWarning: string;
  disclaimer: string;
}

export function EvCalculator() {
  const [raw, setRaw] = useState(350);
  const [fee, setFee] = useState(25);
  const [ship, setShip] = useState(20);
  const [rows, setRows] = useState([
    { grade: 8, probability: 0.35, gradedValueMajor: 700 },
    { grade: 9, probability: 0.45, gradedValueMajor: 1600 },
    { grade: 10, probability: 0.2, gradedValueMajor: 4200 },
  ]);
  const [result, setResult] = useState<EvResult | null>(null);

  const probSum = rows.reduce((s, r) => s + r.probability, 0);

  async function compute() {
    const res = await fetch('/api/grade/expected-value', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawValueMajor: raw,
        gradingFeeMajor: fee,
        shippingMajor: ship,
        outcomes: rows,
      }),
    });
    const body = await res.json();
    if (body.success) setResult(body.data.result);
  }

  return (
    <Card className="space-y-4">
      <CardTitle>Grading expected-value calculator</CardTitle>
      <p className="text-xs text-muted">
        Edit the outcome probabilities to match your read of the card. This is a planning tool, not
        financial advice.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <NumField label="Raw value ($)" value={raw} onChange={setRaw} />
        <NumField label="Grading fee ($)" value={fee} onChange={setFee} />
        <NumField label="Shipping/ins. ($)" value={ship} onChange={setShip} />
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2 text-xs uppercase text-muted">
          <span>Grade</span>
          <span>Probability</span>
          <span>Graded value ($)</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-3 gap-2">
            <input type="number" className="psr-input" value={r.grade} onChange={(e) => update(i, 'grade', +e.target.value)} />
            <input type="number" step="0.05" className="psr-input" value={r.probability} onChange={(e) => update(i, 'probability', +e.target.value)} />
            <input type="number" className="psr-input" value={r.gradedValueMajor} onChange={(e) => update(i, 'gradedValueMajor', +e.target.value)} />
          </div>
        ))}
        <p className={`text-xs ${Math.abs(probSum - 1) > 0.01 ? 'text-warning' : 'text-muted'}`}>
          Probabilities sum to {(probSum * 100).toFixed(0)}%
        </p>
      </div>

      <Button onClick={compute} variant="secondary">
        Calculate
      </Button>

      {result && (
        <div className="space-y-2 rounded-lg border border-border bg-surface-elevated p-4 text-sm">
          <Row label="Total grading costs" value={fmtMinor(result.totalCosts.minor)} />
          <Row label="Expected net if graded" value={fmtMinor(result.expectedGradedValueNet.minor)} strong />
          <Row label="Expected net if sold raw" value={fmtMinor(result.expectedRawNet.minor)} />
          <Row
            label="Expected gain over selling raw"
            value={fmtMinor(result.expectedGainOverRaw.minor)}
            tone={result.expectedGainOverRaw.minor >= 0 ? 'positive' : 'negative'}
          />
          <Row label="Break-even grade" value={result.breakEvenGrade ? `PSA ${result.breakEvenGrade}` : 'None in range'} />
          <Row label={`Downside (PSA ${result.downside.grade})`} value={fmtMinor(result.downside.net.minor)} />
          <Row label={`Upside (PSA ${result.upside.grade})`} value={fmtMinor(result.upside.net.minor)} />
          <p className="pt-2 text-xs text-muted">{result.confidenceWarning}</p>
          <p className="text-xs text-muted">{result.disclaimer}</p>
        </div>
      )}
    </Card>
  );

  function update(i: number, key: 'grade' | 'probability' | 'gradedValueMajor', value: number) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input type="number" className="psr-input" value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'positive' | 'negative' }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span
        className={`tabular-nums ${strong ? 'font-semibold' : ''} ${tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-negative' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}
