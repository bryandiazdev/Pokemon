import 'server-only';
import { getRegistry } from '../providers';
import type { PricingSource, PricePointWrite } from './types';
import type { GradingCompany, RawCondition } from '@psr/types';

/** PricingSource backed by the provider registry (current prices only). */
export function createRegistryPricingSource(): PricingSource {
  const registry = getRegistry();
  const today = () => new Date().toISOString().slice(0, 10);

  return {
    async currentRawMinor(cardExternalId, condition) {
      const prices = await registry.call('rawPricing', 'getCurrentRawPrices', (a) =>
        a.getCurrentRawPrices({ cardExternalId }),
      );
      const match =
        prices.find((p) => p.condition === condition) ??
        prices.find((p) => p.condition === 'near_mint') ??
        prices[0];
      return match?.valueMinor;
    },

    async currentGradedMinor(cardExternalId, gradingCompany, grade) {
      const prices = await registry.call('gradedPricing', 'getCurrentGradedPrices', (a) =>
        a.getCurrentGradedPrices({ cardExternalId, gradingCompany }),
      );
      const match = prices.find((p) => p.grade === grade) ?? prices[0];
      return match?.valueMinor;
    },

    async allCurrentPoints(cardExternalId): Promise<PricePointWrite[]> {
      const date = today();
      const [raw, graded] = await Promise.all([
        registry.call('rawPricing', 'getCurrentRawPrices', (a) =>
          a.getCurrentRawPrices({ cardExternalId }),
        ),
        registry
          .call('gradedPricing', 'getCurrentGradedPrices', (a) =>
            a.getCurrentGradedPrices({ cardExternalId }),
          )
          .catch(() => []),
      ]);

      const points: PricePointWrite[] = [];
      for (const p of raw) {
        points.push({
          cardExternalId,
          provider: p.provider,
          market: p.market,
          currency: p.currency,
          condition: p.condition as RawCondition | undefined,
          valueMinor: p.valueMinor,
          lowMinor: p.lowMinor,
          highMinor: p.highMinor,
          recordedForDate: date,
        });
      }
      for (const g of graded) {
        points.push({
          cardExternalId,
          provider: g.provider,
          market: g.market,
          currency: g.currency,
          gradingCompany: g.gradingCompany as GradingCompany,
          grade: g.grade,
          valueMinor: g.valueMinor,
          lowMinor: g.lowMinor,
          highMinor: g.highMinor,
          recordedForDate: date,
        });
      }
      return points;
    },
  };
}
