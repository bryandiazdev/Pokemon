/**
 * Conservative grade-ceiling rules engine (mirror of the vision service's
 * Python engine, used web-side for display, re-scoring, and tests).
 *
 * Never produces a guaranteed grade. Returns a min/max/ceiling RANGE. Any single
 * serious defect caps the ceiling regardless of otherwise-strong sub-scores.
 */

import psaRules from './rules/psa.json';
import type { SubmissionRecommendation } from '@psr/types';

export interface SubScores {
  centering: number; // 0-100
  corner: number;
  edge: number;
  surface: number;
  structural: number;
  imageQuality: number; // 0-100; low quality reduces confidence
}

export interface LimitingFinding {
  key: keyof typeof psaRules.defectCaps | string;
  severity: 'none' | 'minor' | 'moderate' | 'severe';
  title: string;
}

export interface GradeEstimate {
  estimatedMinGrade: number;
  estimatedMaxGrade: number;
  estimatedCeiling: number;
  overallConfidence: number; // 0-1
  submissionRecommendation: SubmissionRecommendation;
  limitingDefects: string[];
  suggestedRecaptures: string[];
  rulesVersion: string;
}

const IMAGE_QUALITY_FLOOR = 45; // below this we refuse a high-confidence result

/** Map an average sub-score (0-100) to a coarse grade on a 1-10 scale. */
function scoreToGrade(score: number): number {
  if (score >= 97) return 10;
  if (score >= 92) return 9;
  if (score >= 85) return 8;
  if (score >= 75) return 7;
  if (score >= 65) return 6;
  if (score >= 50) return 5;
  if (score >= 35) return 4;
  if (score >= 20) return 3;
  return 2;
}

export function evaluateGrade(
  scores: SubScores,
  findings: LimitingFinding[] = [],
): GradeEstimate {
  const caps = psaRules.defectCaps as unknown as Record<string, number>;
  const rulesVersion = psaRules.rulesVersion;

  const suggestedRecaptures: string[] = [];
  const limitingDefects: string[] = [];

  // Insufficient image quality short-circuits to a low-confidence "retake" result.
  if (scores.imageQuality < IMAGE_QUALITY_FLOOR) {
    return {
      estimatedMinGrade: 1,
      estimatedMaxGrade: 10,
      estimatedCeiling: 10,
      overallConfidence: 0.15,
      submissionRecommendation: 'Insufficient image quality',
      limitingDefects: ['Image quality too low for a reliable estimate'],
      suggestedRecaptures: [
        'Retake in brighter indirect light with the full card in frame and in focus.',
      ],
      rulesVersion,
    };
  }

  // Base grade from geometry/condition sub-scores (centering & corners weigh most).
  const weighted =
    scores.centering * 0.28 +
    scores.corner * 0.26 +
    scores.edge * 0.2 +
    scores.surface * 0.18 +
    scores.structural * 0.08;
  let ceiling = scoreToGrade(weighted);

  // Apply defect caps — the STRICTEST cap wins.
  let seriousDefect = false;
  for (const f of findings) {
    if (f.severity === 'none' || f.severity === 'minor') continue;
    const cap = caps[f.key];
    if (typeof cap === 'number') {
      if (cap < ceiling) ceiling = cap;
      limitingDefects.push(f.title);
      if (f.severity === 'severe') seriousDefect = true;
    }
  }

  // Confidence: driven by image quality + surface visibility, penalized by ambiguity.
  let confidence = Math.min(1, scores.imageQuality / 100);
  if (scores.surface < 60) {
    confidence *= 0.8;
    suggestedRecaptures.push('Add an angled-light photo so the surface can be assessed.');
  }
  confidence = Math.max(0.1, Math.min(0.95, confidence)); // never claim near-certainty

  // Range: ceiling is the max; min reflects downside given uncertainty.
  const estimatedMaxGrade = ceiling;
  const spread = confidence > 0.75 ? 1 : confidence > 0.5 ? 2 : 3;
  const estimatedMinGrade = Math.max(1, ceiling - spread);

  const recommendation = recommend(ceiling, confidence, seriousDefect);

  return {
    estimatedMinGrade,
    estimatedMaxGrade,
    estimatedCeiling: ceiling,
    overallConfidence: Number(confidence.toFixed(2)),
    submissionRecommendation: recommendation,
    limitingDefects,
    suggestedRecaptures,
    rulesVersion,
  };
}

function recommend(
  ceiling: number,
  confidence: number,
  seriousDefect: boolean,
): SubmissionRecommendation {
  if (seriousDefect) return 'Serious condition issue detected';
  if (ceiling >= 9 && confidence >= 0.7) return 'Strong submission candidate';
  if (ceiling >= 8 && confidence >= 0.5) return 'Possible submission candidate';
  if (ceiling >= 7) return 'Borderline; inspect manually';
  return 'Unlikely to justify grading financially';
}

export const PSA_RULES = psaRules;
