import { describe, it, expect } from 'vitest';
import { evaluateGrade } from './engine';
import { computeCentering } from './centering';
import { computeExpectedValue } from './expected-value';
import { fromMajor } from '@psr/types';

describe('grade engine', () => {
  it('gives a strong recommendation for a clean, sharp card', () => {
    const r = evaluateGrade({
      centering: 96,
      corner: 95,
      edge: 94,
      surface: 93,
      structural: 98,
      imageQuality: 90,
    });
    expect(r.estimatedCeiling).toBeGreaterThanOrEqual(9);
    expect(r.estimatedMinGrade).toBeLessThanOrEqual(r.estimatedMaxGrade);
    expect(r.submissionRecommendation).toBe('Strong submission candidate');
    expect(r.overallConfidence).toBeLessThanOrEqual(0.95);
  });

  it('caps the ceiling when a serious defect is present', () => {
    const r = evaluateGrade(
      { centering: 96, corner: 95, edge: 94, surface: 93, structural: 98, imageQuality: 90 },
      [{ key: 'crease', severity: 'severe', title: 'Crease across surface' }],
    );
    expect(r.estimatedCeiling).toBeLessThanOrEqual(4);
    expect(r.submissionRecommendation).toBe('Serious condition issue detected');
    expect(r.limitingDefects.length).toBeGreaterThan(0);
  });

  it('refuses a confident result on poor image quality', () => {
    const r = evaluateGrade({
      centering: 96,
      corner: 95,
      edge: 94,
      surface: 93,
      structural: 98,
      imageQuality: 20,
    });
    expect(r.submissionRecommendation).toBe('Insufficient image quality');
    expect(r.overallConfidence).toBeLessThan(0.3);
  });
});

describe('centering', () => {
  it('scores perfect centering near 100', () => {
    const c = computeCentering({ left: 20, right: 20, top: 20, bottom: 20 });
    expect(c.score).toBeGreaterThan(95);
    expect(c.horizontal).toBe('50/50');
  });
  it('penalizes off-center cards', () => {
    const c = computeCentering({ left: 10, right: 30, top: 20, bottom: 20 });
    expect(c.score).toBeLessThan(80);
    expect(c.horizontal).toBe('75/25');
  });
});

describe('expected value', () => {
  it('does not recommend grading purely on top-grade value', () => {
    const r = computeExpectedValue({
      rawValue: fromMajor(100, 'USD'),
      gradingFee: fromMajor(25, 'USD'),
      shipping: fromMajor(15, 'USD'),
      outcomes: [
        { grade: 8, probability: 0.5, gradedValue: fromMajor(90, 'USD') },
        { grade: 9, probability: 0.4, gradedValue: fromMajor(160, 'USD') },
        { grade: 10, probability: 0.1, gradedValue: fromMajor(1200, 'USD') },
      ],
    });
    expect(r.currency).toBe('USD');
    // Expected net should account for the dominant low-grade outcomes, not just the PSA10 moonshot.
    expect(r.expectedGradedValueNet.minor).toBeLessThan(fromMajor(1200, 'USD').minor);
    expect(r.disclaimer).toMatch(/not financial/i);
  });
});
