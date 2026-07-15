/** Shared test/demo fixtures beyond the provider catalog (users, collections). */

import { DEMO_CARDS } from '@psr/providers/fixtures';

export const DEMO_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'demo@pokemonstockradar.com',
  displayName: 'Demo Collector',
  preferredCurrency: 'USD',
  preferredLanguage: 'en',
  timezone: 'America/New_York',
  isDemo: true,
};

/** A seeded demo collection referencing fixture cards, with cost basis. */
export const DEMO_COLLECTION_ITEMS = [
  {
    id: 'ci-1',
    cardExternalId: 'base1-4',
    quantity: 1,
    ownershipType: 'graded' as const,
    gradingCompany: 'psa' as const,
    grade: '9',
    purchasePriceMinor: 180000,
    purchaseCurrency: 'USD',
    purchaseDate: '2022-05-01',
    notes: 'Demo item — clearly labeled sample data.',
  },
  {
    id: 'ci-2',
    cardExternalId: 'sv4pt5-193',
    quantity: 2,
    ownershipType: 'raw' as const,
    rawCondition: 'near_mint' as const,
    purchasePriceMinor: 9000,
    purchaseCurrency: 'USD',
    purchaseDate: '2024-02-10',
    notes: 'Demo item.',
  },
  {
    id: 'ci-3',
    cardExternalId: 'base1-58',
    quantity: 1,
    ownershipType: 'raw' as const,
    rawCondition: 'lightly_played' as const,
    purchasePriceMinor: 3000,
    purchaseCurrency: 'USD',
    purchaseDate: '2021-11-20',
    notes: 'Demo item.',
  },
];

export { DEMO_CARDS };
