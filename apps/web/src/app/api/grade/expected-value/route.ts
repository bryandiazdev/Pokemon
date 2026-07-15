import { z } from 'zod';
import { jsonOk, withErrorHandling, parse } from '@/lib/api';
import { computeExpectedValue } from '@psr/grading-rules';
import { fromMajor } from '@psr/types';

const bodySchema = z.object({
  rawValueMajor: z.number().min(0),
  currency: z.string().length(3).default('USD'),
  gradingFeeMajor: z.number().min(0).default(25),
  shippingMajor: z.number().min(0).default(20),
  outcomes: z
    .array(
      z.object({
        grade: z.number().min(1).max(10),
        probability: z.number().min(0).max(1),
        gradedValueMajor: z.number().min(0),
      }),
    )
    .min(1),
});

export const POST = withErrorHandling(async (req: Request) => {
  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;
  const v = parsed.value;

  const result = computeExpectedValue({
    rawValue: fromMajor(v.rawValueMajor, v.currency),
    gradingFee: fromMajor(v.gradingFeeMajor, v.currency),
    shipping: fromMajor(v.shippingMajor, v.currency),
    outcomes: v.outcomes.map((o) => ({
      grade: o.grade,
      probability: o.probability,
      gradedValue: fromMajor(o.gradedValueMajor, v.currency),
    })),
  });

  return jsonOk({ result });
});
