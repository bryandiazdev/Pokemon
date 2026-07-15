/**
 * Grading expected-value calculator. NOT financial advice.
 *
 * Does not recommend grading merely because the top grade is valuable — it
 * weighs user-editable outcome probabilities against all costs and fees.
 * Money is integer minor units throughout.
 */

import { money, addMoney, subMoney, mulMoney, type Money } from '@psr/types';

export interface GradeOutcome {
  grade: number;
  /** Probability in [0,1]; the caller should ensure they sum to ~1. */
  probability: number;
  /** Current graded market value for this grade (integer minor units). */
  gradedValue: Money;
}

export interface EvInput {
  rawValue: Money;
  outcomes: GradeOutcome[];
  gradingFee: Money;
  declaredValueFee?: Money;
  shipping?: Money;
  insurance?: Money;
  prepCosts?: Money;
  /** Marketplace selling fee as a fraction of sale price, e.g. 0.13. */
  sellingFeeRate?: number;
  /** Payment processing fee fraction, e.g. 0.029. */
  paymentFeeRate?: number;
}

export interface EvResult {
  currency: string;
  totalCosts: Money;
  expectedGradedValueGross: Money;
  expectedGradedValueNet: Money; // after selling/payment fees and grading costs
  expectedRawNet: Money; // selling raw net of fees
  expectedGainOverRaw: Money;
  breakEvenGrade: number | null;
  downside: { grade: number; net: Money };
  upside: { grade: number; net: Money };
  confidenceWarning: string;
  disclaimer: string;
}

const NOT_ADVICE =
  'This is an estimate for planning only and is not financial or investment advice. Prices, fees, and grading outcomes vary.';

function netOfFees(sale: Money, sellingFeeRate: number, paymentFeeRate: number): Money {
  const feeMinor = Math.round(sale.minor * (sellingFeeRate + paymentFeeRate));
  return subMoney(sale, money(feeMinor, sale.currency));
}

export function computeExpectedValue(input: EvInput): EvResult {
  const currency = input.rawValue.currency;
  const zero = money(0, currency);
  const sellingFeeRate = input.sellingFeeRate ?? 0.13;
  const paymentFeeRate = input.paymentFeeRate ?? 0.029;

  const totalCosts = [
    input.gradingFee,
    input.declaredValueFee ?? zero,
    input.shipping ?? zero,
    input.insurance ?? zero,
    input.prepCosts ?? zero,
  ].reduce(addMoney, zero);

  // Expected gross graded value = Σ p·value.
  let expectedGrossMinor = 0;
  for (const o of input.outcomes) {
    expectedGrossMinor += o.gradedValue.minor * o.probability;
  }
  const expectedGradedValueGross = money(Math.round(expectedGrossMinor), currency);

  // Expected net = Σ p·(net-of-fees value) − grading costs.
  let expectedNetMinor = 0;
  for (const o of input.outcomes) {
    const net = netOfFees(o.gradedValue, sellingFeeRate, paymentFeeRate);
    expectedNetMinor += net.minor * o.probability;
  }
  const expectedGradedValueNet = subMoney(
    money(Math.round(expectedNetMinor), currency),
    totalCosts,
  );

  const expectedRawNet = netOfFees(input.rawValue, sellingFeeRate, paymentFeeRate);
  const expectedGainOverRaw = subMoney(expectedGradedValueNet, expectedRawNet);

  // Break-even: lowest grade whose net-of-fees value ≥ rawNet + grading costs.
  const targetMinor = expectedRawNet.minor + totalCosts.minor;
  const sorted = [...input.outcomes].sort((a, b) => a.grade - b.grade);
  let breakEvenGrade: number | null = null;
  for (const o of sorted) {
    if (netOfFees(o.gradedValue, sellingFeeRate, paymentFeeRate).minor >= targetMinor) {
      breakEvenGrade = o.grade;
      break;
    }
  }

  const downside = sorted[0]
    ? {
        grade: sorted[0].grade,
        net: subMoney(
          netOfFees(sorted[0].gradedValue, sellingFeeRate, paymentFeeRate),
          totalCosts,
        ),
      }
    : { grade: 0, net: subMoney(zero, totalCosts) };
  const top = sorted[sorted.length - 1];
  const upside = top
    ? {
        grade: top.grade,
        net: subMoney(netOfFees(top.gradedValue, sellingFeeRate, paymentFeeRate), totalCosts),
      }
    : { grade: 0, net: subMoney(zero, totalCosts) };

  const confidenceWarning =
    'Outcome probabilities are estimates you can edit. Computer-vision confidence is limited by photo quality; a grading company may return a different result.';

  return {
    currency,
    totalCosts,
    expectedGradedValueGross,
    expectedGradedValueNet,
    expectedRawNet,
    expectedGainOverRaw,
    breakEvenGrade,
    downside,
    upside,
    confidenceWarning,
    disclaimer: NOT_ADVICE,
  };
}

/** Convenience: multiply a per-copy value by quantity (integer). */
export const scaleValue = (m: Money, qty: number): Money => mulMoney(m, qty);
